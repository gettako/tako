package deploy

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"google.golang.org/grpc/metadata"

	"gettako.dev/tako/server/db"
	"gettako.dev/tako/server/nodes"
	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
)

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "deploy_test.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return database
}

func insertTestServerAndService(t *testing.T, database *sql.DB) (string, string) {
	t.Helper()
	serverID := "srv_node_01"
	_, err := database.Exec(`
		INSERT INTO servers (id, name, status, agent_version)
		VALUES (?, 'Test Worker', 'online', '0.1.0')
	`, serverID)
	if err != nil {
		t.Fatalf("failed to insert test server: %v", err)
	}

	projectID := "prj_01"
	_, err = database.Exec(`
		INSERT INTO projects (id, name)
		VALUES (?, 'Test Project')
	`, projectID)
	if err != nil {
		t.Fatalf("failed to insert test project: %v", err)
	}

	serviceID := "svc_web_01"
	_, err = database.Exec(`
		INSERT INTO services (id, project_id, server_id, name, repository, branch, dockerfile_path, internal_port, health_check_path, status)
		VALUES (?, ?, ?, 'Web API', 'https://github.com/octocat/hello-world', 'main', 'Dockerfile', 3000, '/healthz', 'stopped')
	`, serviceID, projectID, serverID)
	if err != nil {
		t.Fatalf("failed to insert test service: %v", err)
	}

	return serverID, serviceID
}

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

func TestTriggerDeployment(t *testing.T) {
	database := setupTestDB(t)
	serverID, serviceID := insertTestServerAndService(t, database)
	masterKey := crypto.DeriveKey("test-secret-key-32-bytes-long!")
	nm := nodes.NewNodeManager(database)

	ctx := context.Background()
	mockStream := &mockStreamServer{}
	_, err := nm.RegisterSession(ctx, serverID, mockStream)
	if err != nil {
		t.Fatalf("RegisterSession failed: %v", err)
	}

	orc := NewOrchestrator(database, nm, masterKey)

	branch := "feature-test"
	commit := "abc1234"
	dep, err := orc.TriggerDeployment(ctx, serviceID, &models.CreateDeploymentRequest{
		Branch:    &branch,
		CommitSHA: &commit,
	})
	if err != nil {
		t.Fatalf("TriggerDeployment failed: %v", err)
	}

	if dep.Status != models.DeploymentBuilding {
		t.Errorf("expected status 'building', got '%s'", dep.Status)
	}
	if dep.Branch != "feature-test" {
		t.Errorf("expected branch 'feature-test', got '%s'", dep.Branch)
	}
	if dep.CommitSHA != "abc1234" {
		t.Errorf("expected commit 'abc1234', got '%s'", dep.CommitSHA)
	}

	// Verify in DB
	var dbStatus string
	err = database.QueryRow(`SELECT status FROM deployments WHERE id = ?`, dep.ID).Scan(&dbStatus)
	if err != nil {
		t.Fatalf("failed to query deployment from DB: %v", err)
	}
	if dbStatus != "building" {
		t.Errorf("expected DB deployment status 'building', got '%s'", dbStatus)
	}

	// Verify service status updated
	var svcStatus string
	err = database.QueryRow(`SELECT status FROM services WHERE id = ?`, serviceID).Scan(&svcStatus)
	if err != nil {
		t.Fatalf("failed to query service from DB: %v", err)
	}
	if svcStatus != "building" {
		t.Errorf("expected service status 'building', got '%s'", svcStatus)
	}
}

func TestBuildLogsBroadcastingAndLateSubscriber(t *testing.T) {
	database := setupTestDB(t)
	_, serviceID := insertTestServerAndService(t, database)
	masterKey := crypto.DeriveKey("test-secret-key-32-bytes-long!")
	orc := NewOrchestrator(database, nil, masterKey)

	ctx := context.Background()
	dep, err := orc.TriggerDeployment(ctx, serviceID, nil)
	if err != nil {
		t.Fatalf("TriggerDeployment failed: %v", err)
	}

	// 1. Subscribe live client
	liveCh, liveUnsub, err := orc.SubscribeBuildLogs(ctx, dep.ID)
	if err != nil {
		t.Fatalf("SubscribeBuildLogs failed: %v", err)
	}
	defer liveUnsub()

	// 2. Push chunk 1
	orc.HandleBuildLog("node_1", &protocol.BuildLogChunk{
		DeploymentId: dep.ID,
		Step:         "1/3",
		LogLine:      "FROM alpine:latest",
		IsError:      false,
		Timestamp:    time.Now().UnixNano(),
	})

	// Live client should get step event and log line event
	select {
	case evt := <-liveCh:
		if evt.Event != "build_step" || evt.Step != "1/3" {
			t.Errorf("expected build_step '1/3', got %+v", evt)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for live build_step event")
	}

	select {
	case evt := <-liveCh:
		if evt.Event != "build_log" || evt.Line != "FROM alpine:latest" {
			t.Errorf("expected build_log 'FROM alpine:latest', got %+v", evt)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for live build_log event")
	}

	// 3. Push chunk 2
	orc.HandleBuildLog("node_1", &protocol.BuildLogChunk{
		DeploymentId: dep.ID,
		LogLine:      "echo 'Build finished'",
		IsError:      false,
		Timestamp:    time.Now().UnixNano(),
	})

	select {
	case evt := <-liveCh:
		if evt.Event != "build_log" || evt.Line != "echo 'Build finished'" {
			t.Errorf("expected second build_log, got %+v", evt)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for second build_log event")
	}

	// 4. Test Late-Connecting Subscriber
	lateCh, lateUnsub, err := orc.SubscribeBuildLogs(ctx, dep.ID)
	if err != nil {
		t.Fatalf("SubscribeBuildLogs for late client failed: %v", err)
	}
	defer lateUnsub()

	// Late subscriber should immediately receive all 3 buffered events
	expectedLines := []string{"FROM alpine:latest", "FROM alpine:latest", "echo 'Build finished'"}
	for i, expected := range expectedLines {
		select {
		case evt := <-lateCh:
			if i == 0 && evt.Event != "build_step" {
				t.Errorf("expected event 0 to be build_step, got %s", evt.Event)
			}
			if (i == 1 || i == 2) && evt.Line != expected {
				t.Errorf("event %d line: expected %s, got %s", i, expected, evt.Line)
			}
		case <-time.After(time.Second):
			t.Fatalf("late subscriber timed out waiting for event %d", i)
		}
	}
}

func TestHandleDeploymentStatusSuccessAndFailure(t *testing.T) {
	database := setupTestDB(t)
	_, serviceID := insertTestServerAndService(t, database)
	masterKey := crypto.DeriveKey("test-secret-key-32-bytes-long!")
	orc := NewOrchestrator(database, nil, masterKey)

	ctx := context.Background()

	// --- Success Flow ---
	dep1, err := orc.TriggerDeployment(ctx, serviceID, nil)
	if err != nil {
		t.Fatalf("TriggerDeployment 1 failed: %v", err)
	}

	ch1, unsub1, err := orc.SubscribeBuildLogs(ctx, dep1.ID)
	if err != nil {
		t.Fatalf("SubscribeBuildLogs failed: %v", err)
	}
	defer unsub1()

	// Status transition: healthy
	orc.HandleDeploymentStatus("node_1", &protocol.DeploymentStatusTransition{
		DeploymentId: dep1.ID,
		Status:       "healthy",
		ImageTag:     "tako-app-svc_web_01:dep1",
	})

	select {
	case evt := <-ch1:
		if evt.Event != "build_complete" || evt.Status != "success" {
			t.Errorf("expected build_complete with success, got %+v", evt)
		}
		if evt.ImageTag == nil || *evt.ImageTag != "tako-app-svc_web_01:dep1" {
			t.Errorf("expected image tag 'tako-app-svc_web_01:dep1', got %v", evt.ImageTag)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for build_complete success event")
	}

	// Verify DB state for dep1 and service
	var dep1Status string
	var dep1Duration sql.NullInt64
	var dep1ImageTag sql.NullString
	_ = database.QueryRow(`SELECT status, duration_seconds, image_tag FROM deployments WHERE id = ?`, dep1.ID).Scan(&dep1Status, &dep1Duration, &dep1ImageTag)
	if dep1Status != "success" {
		t.Errorf("expected dep1 status 'success', got '%s'", dep1Status)
	}
	if !dep1Duration.Valid || dep1Duration.Int64 < 0 {
		t.Errorf("expected valid duration_seconds, got %v", dep1Duration)
	}
	if !dep1ImageTag.Valid || dep1ImageTag.String != "tako-app-svc_web_01:dep1" {
		t.Errorf("expected image tag saved in DB, got %v", dep1ImageTag)
	}

	var svcStatus, activeDep string
	_ = database.QueryRow(`SELECT status, active_deployment_id FROM services WHERE id = ?`, serviceID).Scan(&svcStatus, &activeDep)
	if svcStatus != "running" {
		t.Errorf("expected service status 'running', got '%s'", svcStatus)
	}
	if activeDep != dep1.ID {
		t.Errorf("expected active_deployment_id '%s', got '%s'", dep1.ID, activeDep)
	}

	// --- Failure Flow ---
	dep2, err := orc.TriggerDeployment(ctx, serviceID, nil)
	if err != nil {
		t.Fatalf("TriggerDeployment 2 failed: %v", err)
	}

	ch2, unsub2, err := orc.SubscribeBuildLogs(ctx, dep2.ID)
	if err != nil {
		t.Fatalf("SubscribeBuildLogs 2 failed: %v", err)
	}
	defer unsub2()

	orc.HandleDeploymentStatus("node_1", &protocol.DeploymentStatusTransition{
		DeploymentId: dep2.ID,
		Status:       "failed",
		ErrorReason:  "health check timed out after 60s",
	})

	select {
	case evt := <-ch2:
		if evt.Event != "build_complete" || evt.Status != "failed" {
			t.Errorf("expected build_complete with failed, got %+v", evt)
		}
		if evt.Error == nil || *evt.Error != "health check timed out after 60s" {
			t.Errorf("expected error reason, got %v", evt.Error)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for build_complete failed event")
	}

	var dep2Status, errorTrace string
	_ = database.QueryRow(`SELECT status, error_trace FROM deployments WHERE id = ?`, dep2.ID).Scan(&dep2Status, &errorTrace)
	if dep2Status != "failed" {
		t.Errorf("expected dep2 status 'failed', got '%s'", dep2Status)
	}
	if errorTrace != "health check timed out after 60s" {
		t.Errorf("expected error_trace saved in DB, got '%s'", errorTrace)
	}
}

func TestCancelDeployment(t *testing.T) {
	database := setupTestDB(t)
	_, serviceID := insertTestServerAndService(t, database)
	masterKey := crypto.DeriveKey("test-secret-key-32-bytes-long!")
	orc := NewOrchestrator(database, nil, masterKey)

	ctx := context.Background()
	dep, err := orc.TriggerDeployment(ctx, serviceID, nil)
	if err != nil {
		t.Fatalf("TriggerDeployment failed: %v", err)
	}

	ch, unsub, err := orc.SubscribeBuildLogs(ctx, dep.ID)
	if err != nil {
		t.Fatalf("SubscribeBuildLogs failed: %v", err)
	}
	defer unsub()

	cancelledDep, err := orc.CancelDeployment(ctx, serviceID, dep.ID)
	if err != nil {
		t.Fatalf("CancelDeployment failed: %v", err)
	}
	if cancelledDep.Status != models.DeploymentCancelled {
		t.Errorf("expected status 'cancelled', got '%s'", cancelledDep.Status)
	}

	select {
	case evt := <-ch:
		if evt.Event != "build_complete" || evt.Status != "failed" {
			t.Errorf("expected build_complete failed, got %+v", evt)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for cancellation event on SSE subscriber")
	}
}
