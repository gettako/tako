package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gettako.dev/tako/internal/api"
	"gettako.dev/tako/internal/orchestrator"
)

func TestCronJobsAPIAndEngine(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	srv, err := orch.CreateService(ctx, orchestrator.CreateServiceParams{
		ProjectID: "proj-cron-test",
		Name:      "Cron Worker",
		Slug:      "cron-worker",
	})
	if err != nil {
		t.Fatalf("CreateService failed: %v", err)
	}

	var cronJobID string

	t.Run("Create Cron Job", func(t *testing.T) {
		payload := api.CreateCronJobRequest{
			Name:     "Database Backup Cron",
			Schedule: "0 2 * * *",
			Command:  "pg_dump -U postgres app > backup.sql",
		}
		data, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/services/"+srv.ID+"/crons", bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
		}

		var res api.CronJobResponse
		if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if res.ID == "" {
			t.Errorf("expected non-empty ID")
		}
		cronJobID = res.ID
		if res.Name != payload.Name {
			t.Errorf("expected name %s, got %s", payload.Name, res.Name)
		}
		if res.Schedule != payload.Schedule {
			t.Errorf("expected schedule %s, got %s", payload.Schedule, res.Schedule)
		}
		if res.Status != "active" {
			t.Errorf("expected status active, got %s", res.Status)
		}
	})

	t.Run("List Cron Jobs", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+srv.ID+"/crons", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var list []api.CronJobResponse
		if err := json.NewDecoder(rec.Body).Decode(&list); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(list) != 1 {
			t.Fatalf("expected 1 cron job, got %d", len(list))
		}
		if list[0].ID != cronJobID {
			t.Errorf("expected job ID %s, got %s", cronJobID, list[0].ID)
		}
	})

	t.Run("Get Cron Job By ID", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+srv.ID+"/crons/"+cronJobID, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var res api.CronJobResponse
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if res.ID != cronJobID {
			t.Errorf("expected job ID %s, got %s", cronJobID, res.ID)
		}
	})

	t.Run("Update Cron Job", func(t *testing.T) {
		newStatus := "paused"
		payload := api.UpdateCronJobRequest{
			Status: &newStatus,
		}
		data, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPatch, "/api/v1/services/"+srv.ID+"/crons/"+cronJobID, bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var res api.CronJobResponse
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if res.Status != "paused" {
			t.Errorf("expected status paused, got %s", res.Status)
		}
	})

	t.Run("Run Cron Job Now", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/services/"+srv.ID+"/crons/"+cronJobID+"/run", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}

		var run api.CronJobRunResponse
		if err := json.NewDecoder(rec.Body).Decode(&run); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if run.ID == "" {
			t.Errorf("expected non-empty run ID")
		}
		if run.CronJobID != cronJobID {
			t.Errorf("expected cronJobId %s, got %s", cronJobID, run.CronJobID)
		}
		if run.Status != "success" {
			t.Errorf("expected status success, got %s", run.Status)
		}
	})

	t.Run("List Cron Job Runs", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+srv.ID+"/crons/"+cronJobID+"/runs", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var runs []api.CronJobRunResponse
		if err := json.NewDecoder(rec.Body).Decode(&runs); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if len(runs) != 1 {
			t.Fatalf("expected 1 run, got %d", len(runs))
		}
	})

	t.Run("Delete Cron Job", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/api/v1/services/"+srv.ID+"/crons/"+cronJobID, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		// Verify 404
		reqGet := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+srv.ID+"/crons/"+cronJobID, nil)
		recGet := httptest.NewRecorder()
		router.ServeHTTP(recGet, reqGet)
		if recGet.Code != http.StatusNotFound {
			t.Fatalf("expected 404 Not Found after delete, got %d", recGet.Code)
		}
	})

	t.Run("Cron Matcher Unit Tests", func(t *testing.T) {
		t1 := time.Date(2026, 10, 12, 14, 30, 0, 0, time.UTC) // Monday, 14:30
		if !orchestrator.MatchCron("30 14 * * *", t1) {
			t.Errorf("expected 30 14 * * * to match 14:30")
		}
		if !orchestrator.MatchCron("*/5 * * * *", t1) {
			t.Errorf("expected */5 * * * * to match minute 30")
		}
		if orchestrator.MatchCron("*/7 * * * *", t1) {
			t.Errorf("expected */7 * * * * not to match minute 30")
		}
		if !orchestrator.MatchCron("30 14 * * 1", t1) { // 1 = Monday
			t.Errorf("expected Monday match")
		}
	})
}
