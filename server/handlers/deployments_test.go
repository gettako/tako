package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"google.golang.org/grpc/metadata"

	"gettako.dev/tako/server/auth"
	"gettako.dev/tako/server/db"
	"gettako.dev/tako/server/deploy"
	"gettako.dev/tako/server/nodes"
	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
)

type mockStreamServer struct {
	sent []*protocol.ServerMessage
}

func (m *mockStreamServer) Send(msg *protocol.ServerMessage) error {
	m.sent = append(m.sent, msg)
	return nil
}

func (m *mockStreamServer) Recv() (*protocol.AgentMessage, error) {
	return nil, nil
}

func (m *mockStreamServer) SetHeader(metadata.MD) error  { return nil }
func (m *mockStreamServer) SendHeader(metadata.MD) error { return nil }
func (m *mockStreamServer) SetTrailer(metadata.MD)       {}
func (m *mockStreamServer) Context() context.Context     { return context.Background() }
func (m *mockStreamServer) SendMsg(msg any) error        { return nil }
func (m *mockStreamServer) RecvMsg(msg any) error        { return nil }

func setupDeployTestRouter(t *testing.T) (*sql.DB, chi.Router, *http.Cookie, *deploy.Orchestrator, string) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "deploy_api_test.db")

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	masterKey := crypto.DeriveKey("test-secret-key-32-bytes-long!")

	authHandler, err := auth.NewHandler(database, "localhost")
	if err != nil {
		t.Fatalf("failed to create auth handler: %v", err)
	}

	nodeManager := nodes.NewNodeManager(database)
	orchestrator := deploy.NewOrchestrator(database, nodeManager, masterKey)

	crudHandler := NewHandler(database, masterKey, "localhost")
	crudHandler.SetNodeManager(nodeManager)
	crudHandler.SetOrchestrator(orchestrator)

	r := chi.NewRouter()
	r.Route("/api/auth", func(authRouter chi.Router) {
		authHandler.RegisterRoutes(authRouter)
	})
	r.Route("/api", func(apiRouter chi.Router) {
		crudHandler.RegisterRoutes(apiRouter)
	})

	// Login
	loginBody, _ := json.Marshal(auth.LoginRequest{Password: "AdminPassword123!"})
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBody))
	loginRec := httptest.NewRecorder()
	r.ServeHTTP(loginRec, loginReq)

	var sessionCookie *http.Cookie
	for _, c := range loginRec.Result().Cookies() {
		if c.Name == auth.SessionCookieName {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("failed to get session cookie")
	}

	// Insert test server & service
	serverID := "srv_worker_1"
	_, _ = database.Exec(`
		INSERT INTO servers (id, name, status, agent_version)
		VALUES (?, 'Worker 1', 'online', '1.0.0')
	`, serverID)

	// Register session with nodeManager
	mockStream := &mockStreamServer{}
	_, _ = nodeManager.RegisterSession(context.Background(), serverID, mockStream)

	projectID := "prj_1"
	_, _ = database.Exec(`INSERT INTO projects (id, name) VALUES (?, 'Test App')`, projectID)

	serviceID := "svc_1"
	_, _ = database.Exec(`
		INSERT INTO services (id, project_id, server_id, name, repository, branch, dockerfile_path, internal_port, health_check_path, status)
		VALUES (?, ?, ?, 'API Service', 'https://github.com/org/repo', 'main', 'Dockerfile', 8080, '/healthz', 'stopped')
	`, serviceID, projectID, serverID)

	return database, r, sessionCookie, orchestrator, serviceID
}

func TestDeploymentsAPI(t *testing.T) {
	_, r, sessionCookie, orchestrator, serviceID := setupDeployTestRouter(t)

	// 1. POST /api/services/{id}/deployments
	deployReqBody, _ := json.Marshal(models.CreateDeploymentRequest{
		Branch: func(s string) *string { return &s }("main"),
	})
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/services/%s/deployments", serviceID), bytes.NewReader(deployReqBody))
	req.AddCookie(sessionCookie)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202 Accepted, got %d: %s", rec.Code, rec.Body.String())
	}

	var createdDep models.Deployment
	if err := json.Unmarshal(rec.Body.Bytes(), &createdDep); err != nil {
		t.Fatalf("failed to decode created deployment: %v", err)
	}
	if createdDep.ID == "" || createdDep.Status != models.DeploymentBuilding {
		t.Fatalf("unexpected created deployment: %+v", createdDep)
	}

	// 2. GET /api/services/{id}/deployments
	req = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/services/%s/deployments", serviceID), nil)
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}
	var listResp models.DeploymentListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &listResp); err != nil {
		t.Fatalf("failed to decode list response: %v", err)
	}
	if listResp.Total != 1 || len(listResp.Items) != 1 {
		t.Fatalf("expected 1 deployment in list, got total=%d items=%d", listResp.Total, len(listResp.Items))
	}

	// 3. GET /api/services/{id}/deployments/{deployment_id}
	req = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/services/%s/deployments/%s", serviceID, createdDep.ID), nil)
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}
	var detail models.DeploymentDetail
	if err := json.Unmarshal(rec.Body.Bytes(), &detail); err != nil {
		t.Fatalf("failed to decode deployment detail: %v", err)
	}
	if detail.ID != createdDep.ID {
		t.Fatalf("expected detail ID %s, got %s", createdDep.ID, detail.ID)
	}

	// 4. Test SSE Stream: push chunk and verify stream output
	go func() {
		time.Sleep(50 * time.Millisecond)
		orchestrator.HandleBuildLog("srv_worker_1", &protocol.BuildLogChunk{
			DeploymentId: createdDep.ID,
			Step:         "1/2",
			LogLine:      "Step 1: Installing dependencies",
			Timestamp:    time.Now().UnixNano(),
		})
		time.Sleep(50 * time.Millisecond)
		orchestrator.HandleDeploymentStatus("srv_worker_1", &protocol.DeploymentStatusTransition{
			DeploymentId: createdDep.ID,
			Status:       "healthy",
			ImageTag:     "tako-app-svc_1:" + createdDep.ID,
		})
	}()

	req = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/services/%s/logs/build?deployment_id=%s", serviceID, createdDep.ID), nil)
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for SSE, got %d", rec.Code)
	}
	bodyStr := rec.Body.String()
	if !strings.Contains(bodyStr, "build_step") || !strings.Contains(bodyStr, "build_complete") {
		t.Fatalf("expected build_step and build_complete in SSE stream, got: %s", bodyStr)
	}

	// 5. Test Cancel Deployment
	// Create another deployment
	req = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/services/%s/deployments", serviceID), nil)
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	var dep2 models.Deployment
	_ = json.Unmarshal(rec.Body.Bytes(), &dep2)

	cancelReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/services/%s/deployments/%s/cancel", serviceID, dep2.ID), nil)
	cancelReq.AddCookie(sessionCookie)
	cancelRec := httptest.NewRecorder()
	r.ServeHTTP(cancelRec, cancelReq)

	if cancelRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on cancel, got %d: %s", cancelRec.Code, cancelRec.Body.String())
	}
	var cancelled models.Deployment
	_ = json.Unmarshal(cancelRec.Body.Bytes(), &cancelled)
	if cancelled.Status != models.DeploymentCancelled {
		t.Fatalf("expected cancelled status, got %s", cancelled.Status)
	}
}
