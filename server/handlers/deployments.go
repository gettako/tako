package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/server/audit"
)

func (h *Handler) ListDeployments(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")

	var sExists bool
	_ = h.db.QueryRow(`SELECT 1 FROM services WHERE id = ?`, serviceID).Scan(&sExists)
	if !sExists {
		sendError(w, http.StatusNotFound, "Service not found")
		return
	}

	page := 1
	if pStr := r.URL.Query().Get("page"); pStr != "" {
		if p, err := strconv.Atoi(pStr); err == nil && p > 0 {
			page = p
		}
	}

	limit := 10
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 50 {
			limit = l
		}
	}

	offset := (page - 1) * limit

	var total int
	err := h.db.QueryRow(`SELECT count(*) FROM deployments WHERE service_id = ?`, serviceID).Scan(&total)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to count deployments")
		return
	}

	rows, err := h.db.Query(`
		SELECT id, service_id, status, commit_sha, commit_message, commit_author,
		       branch, image_tag, started_at, finished_at, duration_seconds, created_at
		FROM deployments
		WHERE service_id = ?
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, serviceID, limit, offset)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to query deployments")
		return
	}
	defer rows.Close()

	items := make([]models.Deployment, 0)
	for rows.Next() {
		var dep models.Deployment
		var imgTag sql.NullString
		var startedAtStr, finishedAtStr sql.NullString
		var durationSecs sql.NullInt64
		var createdAtStr string

		err := rows.Scan(
			&dep.ID, &dep.ServiceID, &dep.Status, &dep.CommitSHA, &dep.CommitMessage, &dep.CommitAuthor,
			&dep.Branch, &imgTag, &startedAtStr, &finishedAtStr, &durationSecs, &createdAtStr,
		)
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to scan deployment row")
			return
		}

		if imgTag.Valid {
			dep.ImageTag = &imgTag.String
		}
		if startedAtStr.Valid {
			tVal, _ := time.Parse(time.RFC3339, startedAtStr.String)
			if tVal.IsZero() {
				tVal, _ = time.Parse("2006-01-02 15:04:05", startedAtStr.String)
			}
			dep.StartedAt = &tVal
		}
		if finishedAtStr.Valid {
			tVal, _ := time.Parse(time.RFC3339, finishedAtStr.String)
			if tVal.IsZero() {
				tVal, _ = time.Parse("2006-01-02 15:04:05", finishedAtStr.String)
			}
			dep.FinishedAt = &tVal
		}
		if durationSecs.Valid {
			d := int(durationSecs.Int64)
			dep.DurationSeconds = &d
		}
		dep.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
		if dep.CreatedAt.IsZero() {
			dep.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
		}

		items = append(items, dep)
	}

	sendJSON(w, http.StatusOK, models.DeploymentListResponse{
		Items: items,
		Total: total,
		Page:  page,
		Limit: limit,
	})
}

func (h *Handler) CreateDeployment(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")

	var sExists bool
	_ = h.db.QueryRow(`SELECT 1 FROM services WHERE id = ?`, serviceID).Scan(&sExists)
	if !sExists {
		sendError(w, http.StatusNotFound, "Service not found")
		return
	}

	var req models.CreateDeploymentRequest
	if r.Body != nil && r.ContentLength > 0 {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}

	if h.orchestrator == nil {
		sendError(w, http.StatusInternalServerError, "Deployment orchestrator not configured")
		return
	}

	dep, err := h.orchestrator.TriggerDeployment(r.Context(), serviceID, &req)
	if err != nil {
		sendError(w, http.StatusBadRequest, err.Error())
		return
	}

	audit.Record(r.Context(), "service.deploy", "service", serviceID, map[string]any{
		"deployment_id": dep.ID,
		"branch":        dep.Branch,
		"commit_sha":    dep.CommitSHA,
	})
	sendJSON(w, http.StatusAccepted, dep)
}

func (h *Handler) GetDeployment(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	deploymentID := chi.URLParam(r, "deployment_id")

	var dep models.Deployment
	var imgTag sql.NullString
	var startedAtStr, finishedAtStr sql.NullString
	var durationSecs sql.NullInt64
	var createdAtStr string
	var buildStepsRaw sql.NullString
	var errorTrace sql.NullString

	err := h.db.QueryRow(`
		SELECT id, service_id, status, commit_sha, commit_message, commit_author,
		       branch, image_tag, started_at, finished_at, duration_seconds, created_at,
		       build_steps, error_trace
		FROM deployments
		WHERE id = ? AND service_id = ?
	`, deploymentID, serviceID).Scan(
		&dep.ID, &dep.ServiceID, &dep.Status, &dep.CommitSHA, &dep.CommitMessage, &dep.CommitAuthor,
		&dep.Branch, &imgTag, &startedAtStr, &finishedAtStr, &durationSecs, &createdAtStr,
		&buildStepsRaw, &errorTrace,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Deployment not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if imgTag.Valid {
		dep.ImageTag = &imgTag.String
	}
	if startedAtStr.Valid {
		tVal, _ := time.Parse(time.RFC3339, startedAtStr.String)
		if tVal.IsZero() {
			tVal, _ = time.Parse("2006-01-02 15:04:05", startedAtStr.String)
		}
		dep.StartedAt = &tVal
	}
	if finishedAtStr.Valid {
		tVal, _ := time.Parse(time.RFC3339, finishedAtStr.String)
		if tVal.IsZero() {
			tVal, _ = time.Parse("2006-01-02 15:04:05", finishedAtStr.String)
		}
		dep.FinishedAt = &tVal
	}
	if durationSecs.Valid {
		d := int(durationSecs.Int64)
		dep.DurationSeconds = &d
	}
	dep.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
	if dep.CreatedAt.IsZero() {
		dep.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
	}

	buildSteps := make([]models.BuildStep, 0)
	if buildStepsRaw.Valid && buildStepsRaw.String != "" {
		_ = json.Unmarshal([]byte(buildStepsRaw.String), &buildSteps)
	}

	var errTracePtr *string
	if errorTrace.Valid && errorTrace.String != "" {
		errTracePtr = &errorTrace.String
	}

	sendJSON(w, http.StatusOK, models.DeploymentDetail{
		Deployment: dep,
		BuildSteps: buildSteps,
		ErrorTrace: errTracePtr,
	})
}

func (h *Handler) CancelDeployment(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	deploymentID := chi.URLParam(r, "deployment_id")

	if h.orchestrator == nil {
		sendError(w, http.StatusInternalServerError, "Deployment orchestrator not configured")
		return
	}

	dep, err := h.orchestrator.CancelDeployment(r.Context(), serviceID, deploymentID)
	if err != nil {
		sendError(w, http.StatusBadRequest, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, dep)
}

func (h *Handler) RollbackDeployment(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	deploymentID := chi.URLParam(r, "deployment_id")

	var sExists bool
	_ = h.db.QueryRow(`SELECT 1 FROM services WHERE id = ?`, serviceID).Scan(&sExists)
	if !sExists {
		sendError(w, http.StatusNotFound, "Service not found")
		return
	}

	var dep models.Deployment
	var imgTag sql.NullString
	err := h.db.QueryRow(`
		SELECT id, service_id, status, branch, commit_sha, image_tag
		FROM deployments WHERE id = ? AND service_id = ?
	`, deploymentID, serviceID).Scan(&dep.ID, &dep.ServiceID, &dep.Status, &dep.Branch, &dep.CommitSHA, &imgTag)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Target deployment not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if dep.Status != models.DeploymentSuccess || !imgTag.Valid || imgTag.String == "" {
		sendError(w, http.StatusBadRequest, "Cannot rollback to an unsuccessful or missing image deployment")
		return
	}

	isRollback := true
	rollbackTag := imgTag.String
	rollbackDep, err := h.orchestrator.TriggerDeployment(r.Context(), serviceID, &models.CreateDeploymentRequest{
		Branch:           &dep.Branch,
		CommitSHA:        &dep.CommitSHA,
		IsRollback:       &isRollback,
		RollbackImageTag: &rollbackTag,
	})
	if err != nil {
		sendError(w, http.StatusBadRequest, err.Error())
		return
	}

	audit.Record(r.Context(), "service.rollback", "service", serviceID, map[string]any{
		"deployment_id":        rollbackDep.ID,
		"target_deployment_id": deploymentID,
	})
	sendJSON(w, http.StatusAccepted, rollbackDep)
}

func (h *Handler) StreamBuildLogs(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	deploymentID := r.URL.Query().Get("deployment_id")
	if deploymentID == "" {
		sendError(w, http.StatusBadRequest, "deployment_id query parameter is required")
		return
	}

	var dExists bool
	_ = h.db.QueryRow(`SELECT 1 FROM deployments WHERE id = ? AND service_id = ?`, deploymentID, serviceID).Scan(&dExists)
	if !dExists {
		sendError(w, http.StatusNotFound, "Deployment not found")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		sendError(w, http.StatusInternalServerError, "Streaming unsupported by client")
		return
	}

	if h.orchestrator == nil {
		sendError(w, http.StatusInternalServerError, "Deployment orchestrator not configured")
		return
	}

	eventsCh, unsub, err := h.orchestrator.SubscribeBuildLogs(r.Context(), deploymentID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to subscribe to build logs: "+err.Error())
		return
	}
	defer unsub()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	_, _ = fmt.Fprintf(w, ": connected\n\n")
	flusher.Flush()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case evt, ok := <-eventsCh:
			if !ok {
				return
			}
			data, err := json.Marshal(evt)
			if err == nil {
				_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", evt.Event, string(data))
				flusher.Flush()
			}
			if evt.Event == "build_complete" {
				return
			}
		}
	}
}
