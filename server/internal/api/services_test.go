package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"gettako.dev/tako/internal/api"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func TestServiceCRUDAndLifecycle(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	// 1. Prepare project & node
	_, _ = orch.Queries().CreateProject(ctx, db.CreateProjectParams{
		ID:          "prj-test-crud",
		Name:        "CRUD Project",
		Slug:        "crud-project",
		Environment: "production",
		Status:      "healthy",
		Tags:        "[]",
	})

	_, _ = orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      "node-srv-crud",
		Name:        "CRUD Node",
		EnrollToken: "test-enroll",
	})

	var serviceID string

	// 2. POST /api/v1/services - Create
	t.Run("Create Service", func(t *testing.T) {
		payload := api.CreateServiceRequest{
			ProjectID:       "prj-test-crud",
			NodeID:          "node-srv-crud",
			Name:            "Awesome Microservice",
			Slug:            "awesome-ms",
			Type:            "app",
			Repository:      "https://github.com/gettako/sample",
			Branch:          "main",
			Ports:           []int32{8080},
			Domains:         []string{"api.gettako.local"},
			EnvironmentVars: map[string]string{"PORT": "8080", "MODE": "test"},
		}
		data, _ := json.Marshal(payload)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/services", bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
		}

		var res api.ServiceResponse
		if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if res.Name != "Awesome Microservice" || res.Slug != "awesome-ms" {
			t.Fatalf("unexpected service fields: %+v", res)
		}
		if len(res.Domains) != 1 || res.Domains[0] != "api.gettako.local" {
			t.Fatalf("unexpected domains: %+v", res.Domains)
		}
		serviceID = res.ID
	})

	// 3. GET /api/v1/services/{id} - Get single service
	t.Run("Get Service By ID", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+serviceID, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}

		var res api.ServiceResponse
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if res.ID != serviceID || res.Name != "Awesome Microservice" {
			t.Fatalf("unexpected service: %+v", res)
		}
		if len(res.EnvVars) != 2 {
			t.Fatalf("expected 2 env vars, got %d", len(res.EnvVars))
		}
	})

	// 4. GET /api/v1/services - List all
	t.Run("List Services", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/services", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}

		var res []api.ServiceResponse
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if len(res) == 0 {
			t.Fatalf("expected at least 1 service")
		}
	})

	// 5. PATCH /api/v1/services/{id} - Update status (e.g. stopped)
	t.Run("Update Service Status", func(t *testing.T) {
		patchPayload := map[string]string{"status": "stopped"}
		data, _ := json.Marshal(patchPayload)

		req := httptest.NewRequest(http.MethodPatch, "/api/v1/services/"+serviceID, bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}

		// Verify changed status
		reqGet := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+serviceID, nil)
		recGet := httptest.NewRecorder()
		router.ServeHTTP(recGet, reqGet)

		var res api.ServiceResponse
		_ = json.NewDecoder(recGet.Body).Decode(&res)
		if res.Status != "stopped" {
			t.Fatalf("expected status stopped, got %s", res.Status)
		}
	})

	// 6. DELETE /api/v1/services/{id}
	t.Run("Delete Service", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "/api/v1/services/"+serviceID, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}

		// Verify deleted
		reqGet := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+serviceID, nil)
		recGet := httptest.NewRecorder()
		router.ServeHTTP(recGet, reqGet)
		if recGet.Code != http.StatusNotFound {
			t.Fatalf("expected 404 Not Found after delete, got %d", recGet.Code)
		}
	})
}

func TestServiceEnvironmentVariables(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	_, _ = orch.Queries().CreateProject(ctx, db.CreateProjectParams{
		ID:          "prj-test-env",
		Name:        "Env Project",
		Slug:        "env-project",
		Environment: "production",
		Status:      "healthy",
		Tags:        "[]",
	})

	srv, _ := orch.CreateService(ctx, orchestrator.CreateServiceParams{
		ProjectID: "prj-test-env",
		NodeID:    "node-control",
		Name:      "Env App",
		Slug:      "env-app",
		Type:      "app",
	})

	// 1. Initial GET /api/v1/services/{id}/env
	t.Run("Get Initial Empty Env", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+srv.ID+"/env", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		var res []api.ServiceEnvVarResponse
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if len(res) != 0 {
			t.Fatalf("expected 0 env vars, got %d", len(res))
		}
	})

	// 2. PUT /api/v1/services/{id}/env - Add variables
	t.Run("Put Env Variables", func(t *testing.T) {
		payload := []map[string]any{
			{"key": "DB_HOST", "value": "postgres.local", "isSecret": false},
			{"key": "DB_PASS", "value": "supersecret", "isSecret": true},
			{"key": "", "value": "ignored", "isSecret": false}, // Empty key ignored
		}
		data, _ := json.Marshal(payload)

		req := httptest.NewRequest(http.MethodPut, "/api/v1/services/"+srv.ID+"/env", bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var res []api.ServiceEnvVarResponse
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if len(res) != 2 {
			t.Fatalf("expected 2 valid env vars returned, got %d", len(res))
		}

		foundSecret := false
		for _, ev := range res {
			if ev.Key == "DB_PASS" && ev.IsSecret {
				foundSecret = true
			}
		}
		if !foundSecret {
			t.Fatalf("expected DB_PASS to be secret")
		}
	})

	// 3. GET /api/v1/services/{id}/env - Verify persisted
	t.Run("Verify Persisted Env", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+srv.ID+"/env", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		var res []api.ServiceEnvVarResponse
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if len(res) != 2 {
			t.Fatalf("expected 2 persisted env vars, got %d", len(res))
		}
	})
}

func TestServiceDeploymentsAndLogs(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	_, _ = orch.Queries().CreateProject(ctx, db.CreateProjectParams{
		ID:          "prj-test-dep",
		Name:        "Dep Project",
		Slug:        "dep-project",
		Environment: "production",
		Status:      "healthy",
		Tags:        "[]",
	})

	srv, _ := orch.CreateService(ctx, orchestrator.CreateServiceParams{
		ProjectID: "prj-test-dep",
		NodeID:    "node-control",
		Name:      "Deploy App",
		Slug:      "deploy-app",
		Type:      "app",
	})

	var depID string

	// 1. POST /api/v1/services/{id}/deploy
	t.Run("Trigger Deployment", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/services/"+srv.ID+"/deploy", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusAccepted {
			t.Fatalf("expected 202 Accepted, got %d", rec.Code)
		}

		var res map[string]string
		_ = json.NewDecoder(rec.Body).Decode(&res)
		depID = res["deploymentId"]
		if depID == "" {
			t.Fatalf("expected non-empty deploymentId")
		}
	})

	// 2. GET /api/v1/deployments/{id}
	t.Run("Get Deployment", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/deployments/"+depID, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
	})

	// 3. GET /api/v1/services/{id}/deployments
	t.Run("List Service Deployments", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+srv.ID+"/deployments", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
	})

	// 4. GET /api/v1/deployments?serviceId=...
	t.Run("Filter Deployments By Query", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/deployments?serviceId="+srv.ID, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
	})

	// 5. GET /api/v1/deployments/{id}/logs (SSE)
	t.Run("Stream Deployment Logs SSE", func(t *testing.T) {
		// Populate some initial logs in the deployment
		_ = orch.Queries().AppendDeploymentLog(ctx, db.AppendDeploymentLogParams{
			ID:     depID,
			Logs:   "[Build] Building container image...\n[Live] Service live\n",
			Status: "live",
			Steps:  "[]",
		})

		ctxTimeout, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
		defer cancel()

		req := httptest.NewRequest(http.MethodGet, "/api/v1/deployments/"+depID+"/logs", nil).WithContext(ctxTimeout)
		rec := httptest.NewRecorder()

		// Serve in goroutine because SSE loop blocks until context cancelled
		doneCh := make(chan struct{})
		go func() {
			router.ServeHTTP(rec, req)
			close(doneCh)
		}()

		select {
		case <-doneCh:
		case <-time.After(1 * time.Second):
			t.Fatalf("SSE handler did not exit after context cancellation")
		}

		contentType := rec.Header().Get("Content-Type")
		if !strings.Contains(contentType, "text/event-stream") {
			t.Fatalf("expected text/event-stream header, got %s", contentType)
		}

		body := rec.Body.String()
		if !strings.Contains(body, "[Build] Building container image...") {
			t.Fatalf("expected body to contain initial logs, got: %s", body)
		}
	})

	// 6. GET /api/v1/deployments/{id}/logs/history
	t.Run("Get Deployment Logs History", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/deployments/"+depID+"/logs/history", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}

		historyLogs := rec.Body.String()
		if !strings.Contains(historyLogs, "[Build] Building container image...") {
			t.Fatalf("unexpected history response: %s", historyLogs)
		}
	})
}

func TestServiceExecAndLogsWithAgentSession(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	_, _ = orch.Queries().CreateProject(ctx, db.CreateProjectParams{
		ID:          "prj-test-exec",
		Name:        "Exec Project",
		Slug:        "exec-project",
		Environment: "production",
		Status:      "healthy",
		Tags:        "[]",
	})

	srv, _ := orch.CreateService(ctx, orchestrator.CreateServiceParams{
		ProjectID: "prj-test-exec",
		NodeID:    "node-worker-agent",
		Name:      "Exec App",
		Slug:      "exec-app",
		Type:      "app",
	})

	// Create and register mock AgentSession
	taskChan := make(chan *takov1.MasterTask, 10)
	sess := orch.RegisterAgentSession("node-worker-agent", taskChan)
	defer orch.UnregisterAgentSession("node-worker-agent")

	// Mock agent task loop
	stopMock := make(chan struct{})
	defer close(stopMock)

	go func() {
		for {
			select {
			case <-stopMock:
				return
			case task := <-taskChan:
				if execReq := task.GetExec(); execReq != nil {
					sess.HandleResult(&takov1.AgentTaskResult{
						TaskId: task.TaskId,
						Result: &takov1.AgentTaskResult_ExecResult{
							ExecResult: &takov1.ExecCommandResponse{
								Output:   "root\n",
								ExitCode: 0,
							},
						},
					})
				} else if logsReq := task.GetContainerLogs(); logsReq != nil {
					sess.HandleResult(&takov1.AgentTaskResult{
						TaskId: task.TaskId,
						Result: &takov1.AgentTaskResult_ContainerLogsResult{
							ContainerLogsResult: &takov1.ContainerLogsResponse{
								Logs: "2026-10-07T06:00:00Z App is running successfully\n",
							},
						},
					})
				} else if actReq := task.GetContainerAction(); actReq != nil {
					sess.HandleResult(&takov1.AgentTaskResult{
						TaskId: task.TaskId,
						Result: &takov1.AgentTaskResult_ContainerActionResult{
							ContainerActionResult: &takov1.ContainerActionResponse{
								Success: true,
								Message: "Action executed",
							},
						},
					})
				}
			}
		}
	}()

	// 1. POST /api/v1/services/{id}/exec
	t.Run("Dispatch Exec Command to Agent", func(t *testing.T) {
		payload := map[string]string{"command": "whoami"}
		data, _ := json.Marshal(payload)

		req := httptest.NewRequest(http.MethodPost, "/api/v1/services/"+srv.ID+"/exec", bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var res map[string]any
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if res["output"] != "root\n" || res["exitCode"] != float64(0) {
			t.Fatalf("unexpected exec response: %+v", res)
		}
	})

	// 2. GET /api/v1/services/{id}/container-logs
	t.Run("Dispatch Container Logs to Agent", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/services/"+srv.ID+"/container-logs", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}

		var res map[string]string
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if !strings.Contains(res["logs"], "App is running successfully") {
			t.Fatalf("unexpected container logs response: %+v", res)
		}
	})

	// 3. PATCH /api/v1/services/{id} - Dispatches container action to Agent
	t.Run("Dispatch Container Action to Agent", func(t *testing.T) {
		payload := map[string]string{"status": "stopped"}
		data, _ := json.Marshal(payload)

		req := httptest.NewRequest(http.MethodPatch, "/api/v1/services/"+srv.ID, bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
		}
	})
}

func TestServiceValidationAndEdgeCases(t *testing.T) {
	router, _ := setupTestRouter(t)

	// 1. Create with invalid JSON
	t.Run("Invalid JSON Create Service", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/services", strings.NewReader("invalid-json{"))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d", rec.Code)
		}
	})

	// 2. Non-existent service ID
	t.Run("Non-existent Service ID", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/services/non-existent-id", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("expected 404 Not Found, got %d", rec.Code)
		}
	})

	// 3. Exec on non-existent service
	t.Run("Exec Non-existent Service", func(t *testing.T) {
		payload := map[string]string{"command": "ls"}
		data, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/services/non-existent-id/exec", bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("expected 404 Not Found, got %d", rec.Code)
		}
	})

	// 4. Exec with empty command
	t.Run("Exec Empty Command", func(t *testing.T) {
		payload := map[string]string{"command": ""}
		data, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/services/srv-dummy/exec", bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound && rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 or 404, got %d", rec.Code)
		}
	})
}
