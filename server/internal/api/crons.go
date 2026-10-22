package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
	"github.com/go-chi/chi/v5"
)

// CronJobResponse represents a scheduled service cron job along with its last execution status.
type CronJobResponse struct {
	ID         string  `json:"id"`
	ServiceID  string  `json:"serviceId"`
	Name       string  `json:"name"`
	Schedule   string  `json:"schedule"`
	Command    string  `json:"command"`
	Status     string  `json:"status"`
	LastRunAt  *string `json:"lastRunAt,omitempty"`
	NextRunAt  *string `json:"nextRunAt,omitempty"`
	LastStatus *string `json:"lastStatus,omitempty"`
	CreatedAt  string  `json:"createdAt"`
}

// CronJobRunResponse models the execution telemetry (exit code, output logs, duration) of a single run.
type CronJobRunResponse struct {
	ID         string `json:"id"`
	CronJobID  string `json:"cronJobId"`
	StartedAt  string `json:"startedAt"`
	FinishedAt string `json:"finishedAt,omitempty"`
	DurationMS int64  `json:"durationMs"`
	Status     string `json:"status"`
	ExitCode   int64  `json:"exitCode"`
	Output     string `json:"output"`
}

// CreateCronJobRequest specifies properties needed to create a new cron schedule for a service.
type CreateCronJobRequest struct {
	Name     string `json:"name"`
	Schedule string `json:"schedule"`
	Command  string `json:"command"`
}

// UpdateCronJobRequest allows modifying an existing cron job schedule, command, or active status.
type UpdateCronJobRequest struct {
	Name     *string `json:"name,omitempty"`
	Schedule *string `json:"schedule,omitempty"`
	Command  *string `json:"command,omitempty"`
	Status   *string `json:"status,omitempty"`
}

// formatCronJob converts a database CronJob model and recent runs into an API response struct.
func formatCronJob(job db.CronJob, runs []db.CronJobRun) CronJobResponse {
	resp := CronJobResponse{
		ID:        job.ID,
		ServiceID: job.ServiceID,
		Name:      job.Name,
		Schedule:  job.Schedule,
		Command:   job.Command,
		Status:    job.Status,
		CreatedAt: job.CreatedAt.Format(time.RFC3339),
	}

	if len(runs) > 0 {
		latest := runs[0]
		lastRun := latest.StartedAt.Format(time.RFC3339)
		resp.LastRunAt = &lastRun
		lastStat := latest.Status
		resp.LastStatus = &lastStat
	}

	return resp
}

// formatCronJobRun converts a database run record into a structured API response.
func formatCronJobRun(r db.CronJobRun) CronJobRunResponse {
	duration := int64(0)
	finStr := ""
	if r.FinishedAt.Valid {
		finStr = r.FinishedAt.Time.Format(time.RFC3339)
		duration = r.FinishedAt.Time.Sub(r.StartedAt).Milliseconds()
		if duration < 0 {
			duration = 0
		}
	}

	return CronJobRunResponse{
		ID:         r.ID,
		CronJobID:  r.CronJobID,
		StartedAt:  r.StartedAt.Format(time.RFC3339),
		FinishedAt: finStr,
		DurationMS: duration,
		Status:     r.Status,
		ExitCode:   r.ExitCode,
		Output:     r.Output,
	}
}

func registerCronRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/services/{id}/crons", func(r chi.Router) {
		// GET /api/v1/services/{id}/crons
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			serviceID := chi.URLParam(r, "id")
			jobs, err := orch.Queries().ListCronJobsByService(r.Context(), serviceID)
			if err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			result := make([]CronJobResponse, 0, len(jobs))
			for _, job := range jobs {
				runs, _ := orch.Queries().ListCronJobRuns(r.Context(), job.ID)
				result = append(result, formatCronJob(job, runs))
			}
			RespondJSON(w, http.StatusOK, result)
		})

		// POST /api/v1/services/{id}/crons
		r.Post("/", func(w http.ResponseWriter, r *http.Request) {
			serviceID := chi.URLParam(r, "id")
			var req CreateCronJobRequest
			if err := DecodeJSON(r, &req); err != nil {
				RespondError(w, http.StatusBadRequest, "invalid request body")
				return
			}

			req.Name = strings.TrimSpace(req.Name)
			req.Schedule = strings.TrimSpace(req.Schedule)
			req.Command = strings.TrimSpace(req.Command)
			if req.Name == "" || req.Schedule == "" || req.Command == "" {
				RespondError(w, http.StatusBadRequest, "name, schedule, and command are required")
				return
			}

			b := make([]byte, 6)
			_, _ = rand.Read(b)
			cronID := "cron-" + hex.EncodeToString(b)

			job, err := orch.Queries().CreateCronJob(r.Context(), db.CreateCronJobParams{
				ID:        cronID,
				ServiceID: serviceID,
				Name:      req.Name,
				Schedule:  req.Schedule,
				Command:   req.Command,
				Status:    "active",
			})
			if err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			RespondJSON(w, http.StatusCreated, formatCronJob(job, nil))
		})

		// GET /api/v1/services/{id}/crons/{cronId}
		r.Get("/{cronId}", func(w http.ResponseWriter, r *http.Request) {
			cronID := chi.URLParam(r, "cronId")
			job, err := orch.Queries().GetCronJobByID(r.Context(), cronID)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					RespondError(w, http.StatusNotFound, "cron job not found")
					return
				}
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}
			runs, _ := orch.Queries().ListCronJobRuns(r.Context(), job.ID)
			RespondJSON(w, http.StatusOK, formatCronJob(job, runs))
		})

		// PATCH /api/v1/services/{id}/crons/{cronId}
		r.Patch("/{cronId}", func(w http.ResponseWriter, r *http.Request) {
			cronID := chi.URLParam(r, "cronId")
			job, err := orch.Queries().GetCronJobByID(r.Context(), cronID)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					RespondError(w, http.StatusNotFound, "cron job not found")
					return
				}
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			var req UpdateCronJobRequest
			if err := DecodeJSON(r, &req); err != nil {
				RespondError(w, http.StatusBadRequest, "invalid request body")
				return
			}

			name := job.Name
			if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
				name = strings.TrimSpace(*req.Name)
			}
			schedule := job.Schedule
			if req.Schedule != nil && strings.TrimSpace(*req.Schedule) != "" {
				schedule = strings.TrimSpace(*req.Schedule)
			}
			command := job.Command
			if req.Command != nil && strings.TrimSpace(*req.Command) != "" {
				command = strings.TrimSpace(*req.Command)
			}
			status := job.Status
			if req.Status != nil && (*req.Status == "active" || *req.Status == "paused") {
				status = *req.Status
			}

			updated, err := orch.Queries().UpdateCronJob(r.Context(), db.UpdateCronJobParams{
				ID:       cronID,
				Name:     name,
				Schedule: schedule,
				Command:  command,
				Status:   status,
			})
			if err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			runs, _ := orch.Queries().ListCronJobRuns(r.Context(), cronID)
			RespondJSON(w, http.StatusOK, formatCronJob(updated, runs))
		})

		// DELETE /api/v1/services/{id}/crons/{cronId}
		r.Delete("/{cronId}", func(w http.ResponseWriter, r *http.Request) {
			cronID := chi.URLParam(r, "cronId")
			_, err := orch.Queries().GetCronJobByID(r.Context(), cronID)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					RespondError(w, http.StatusNotFound, "cron job not found")
					return
				}
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			if err := orch.Queries().DeleteCronJob(r.Context(), cronID); err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}
			RespondJSON(w, http.StatusOK, map[string]bool{"success": true})
		})

		// POST /api/v1/services/{id}/crons/{cronId}/run
		r.Post("/{cronId}/run", func(w http.ResponseWriter, r *http.Request) {
			cronID := chi.URLParam(r, "cronId")
			job, err := orch.Queries().GetCronJobByID(r.Context(), cronID)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					RespondError(w, http.StatusNotFound, "cron job not found")
					return
				}
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			run, err := orch.ExecuteCronJob(r.Context(), job)
			if err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			RespondJSON(w, http.StatusOK, formatCronJobRun(*run))
		})

		// GET /api/v1/services/{id}/crons/{cronId}/runs
		r.Get("/{cronId}/runs", func(w http.ResponseWriter, r *http.Request) {
			cronID := chi.URLParam(r, "cronId")
			runs, err := orch.Queries().ListCronJobRuns(r.Context(), cronID)
			if err != nil {
				RespondError(w, http.StatusInternalServerError, err.Error())
				return
			}

			result := make([]CronJobRunResponse, 0, len(runs))
			for _, run := range runs {
				result = append(result, formatCronJobRun(run))
			}
			RespondJSON(w, http.StatusOK, result)
		})
	})
}
