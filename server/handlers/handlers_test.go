package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"google.golang.org/grpc"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
	"gettako.dev/tako/server/auth"
	"gettako.dev/tako/server/db"
	"gettako.dev/tako/server/nodes"
)

func setupTestRouter(t *testing.T) (*sql.DB, chi.Router, *http.Cookie) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "crud_test.db")

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

	crudHandler := NewHandler(database, masterKey, "localhost")

	r := chi.NewRouter()
	r.Route("/api/auth", func(authRouter chi.Router) {
		authHandler.RegisterRoutes(authRouter)
	})
	r.Route("/api", func(apiRouter chi.Router) {
		crudHandler.RegisterRoutes(apiRouter)
	})

	// Login to get session cookie
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
		t.Fatal("failed to acquire session cookie")
	}

	return database, r, sessionCookie
}

func TestProjectCRUD(t *testing.T) {
	_, r, cookie := setupTestRouter(t)

	// 1. Create Project
	desc := "Acme production apps"
	createBody, _ := json.Marshal(models.CreateProjectRequest{
		Name:        "Acme Corp",
		Description: &desc,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(createBody))
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var created models.Project
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	if created.ID == "" || created.Name != "Acme Corp" {
		t.Fatalf("invalid created project: %+v", created)
	}

	// 2. List Projects
	listReq := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	listReq.AddCookie(cookie)
	listRec := httptest.NewRecorder()
	r.ServeHTTP(listRec, listReq)

	if listRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", listRec.Code, listRec.Body.String())
	}
	var projects []models.Project
	_ = json.Unmarshal(listRec.Body.Bytes(), &projects)
	if len(projects) != 1 {
		t.Fatalf("expected 1 project, got %d", len(projects))
	}

	// 3. Get Project Detail
	getReq := httptest.NewRequest(http.MethodGet, "/api/projects/"+created.ID, nil)
	getReq.AddCookie(cookie)
	getRec := httptest.NewRecorder()
	r.ServeHTTP(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", getRec.Code)
	}
	var detail models.ProjectDetail
	_ = json.Unmarshal(getRec.Body.Bytes(), &detail)
	if detail.Name != "Acme Corp" {
		t.Errorf("expected project name 'Acme Corp', got %s", detail.Name)
	}

	// 4. Update Project
	newName := "Acme Enterprise"
	updateBody, _ := json.Marshal(models.UpdateProjectRequest{
		Name: &newName,
	})
	updateReq := httptest.NewRequest(http.MethodPatch, "/api/projects/"+created.ID, bytes.NewReader(updateBody))
	updateReq.AddCookie(cookie)
	updateRec := httptest.NewRecorder()
	r.ServeHTTP(updateRec, updateReq)

	if updateRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", updateRec.Code)
	}
	var updated models.Project
	_ = json.Unmarshal(updateRec.Body.Bytes(), &updated)
	if updated.Name != "Acme Enterprise" {
		t.Errorf("expected updated name 'Acme Enterprise', got %s", updated.Name)
	}

	// 5. Delete Project
	delReq := httptest.NewRequest(http.MethodDelete, "/api/projects/"+created.ID, nil)
	delReq.AddCookie(cookie)
	delRec := httptest.NewRecorder()
	r.ServeHTTP(delRec, delReq)

	if delRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on delete, got %d", delRec.Code)
	}

	// Verify deleted
	getDeletedReq := httptest.NewRequest(http.MethodGet, "/api/projects/"+created.ID, nil)
	getDeletedReq.AddCookie(cookie)
	getDeletedRec := httptest.NewRecorder()
	r.ServeHTTP(getDeletedRec, getDeletedReq)

	if getDeletedRec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found, got %d", getDeletedRec.Code)
	}
}

func TestServerAndServiceCascadeCRUD(t *testing.T) {
	_, r, cookie := setupTestRouter(t)

	// 1. Create Server
	serverHost := "203.0.113.19"
	srvBody, _ := json.Marshal(models.CreateServerRequest{
		Name: "Primary Node",
		Host: &serverHost,
	})
	srvReq := httptest.NewRequest(http.MethodPost, "/api/servers", bytes.NewReader(srvBody))
	srvReq.AddCookie(cookie)
	srvRec := httptest.NewRecorder()
	r.ServeHTTP(srvRec, srvReq)

	if srvRec.Code != http.StatusCreated {
		t.Fatalf("create server failed: %d: %s", srvRec.Code, srvRec.Body.String())
	}
	var srvResp models.CreateServerResponse
	_ = json.Unmarshal(srvRec.Body.Bytes(), &srvResp)
	if srvResp.Server.ID == "" || srvResp.EnrollmentToken == "" {
		t.Fatalf("invalid server response: %+v", srvResp)
	}

	// 2. Create Project
	prjBody, _ := json.Marshal(models.CreateProjectRequest{Name: "Backend Services"})
	prjReq := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(prjBody))
	prjReq.AddCookie(cookie)
	prjRec := httptest.NewRecorder()
	r.ServeHTTP(prjRec, prjReq)
	var prj models.Project
	_ = json.Unmarshal(prjRec.Body.Bytes(), &prj)

	// 3. Create Service
	svcBody, _ := json.Marshal(models.CreateServiceRequest{
		ProjectID:       prj.ID,
		ServerID:        srvResp.Server.ID,
		Name:            "api-backend",
		Repository:      "octopy/api",
		Branch:          "main",
		DockerfilePath:  "Dockerfile",
		InternalPort:    8080,
		HealthCheckPath: "/healthz",
	})
	svcReq := httptest.NewRequest(http.MethodPost, "/api/services", bytes.NewReader(svcBody))
	svcReq.AddCookie(cookie)
	svcRec := httptest.NewRecorder()
	r.ServeHTTP(svcRec, svcReq)

	if svcRec.Code != http.StatusCreated {
		t.Fatalf("create service failed: %d: %s", svcRec.Code, svcRec.Body.String())
	}
	var svc models.Service
	_ = json.Unmarshal(svcRec.Body.Bytes(), &svc)
	if svc.ID == "" || svc.Name != "api-backend" {
		t.Fatalf("invalid service: %+v", svc)
	}

	// 4. Verify Server Detail includes Service
	srvGetReq := httptest.NewRequest(http.MethodGet, "/api/servers/"+srvResp.Server.ID, nil)
	srvGetReq.AddCookie(cookie)
	srvGetRec := httptest.NewRecorder()
	r.ServeHTTP(srvGetRec, srvGetReq)
	var srvDetail models.ServerDetail
	_ = json.Unmarshal(srvGetRec.Body.Bytes(), &srvDetail)
	if len(srvDetail.Services) != 1 {
		t.Fatalf("expected 1 service assigned to server, got %d", len(srvDetail.Services))
	}

	// 5. Deleting server while service exists should fail
	delSrvReq := httptest.NewRequest(http.MethodDelete, "/api/servers/"+srvResp.Server.ID, nil)
	delSrvReq.AddCookie(cookie)
	delSrvRec := httptest.NewRecorder()
	r.ServeHTTP(delSrvRec, delSrvReq)
	if delSrvRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when deleting server with active service, got %d", delSrvRec.Code)
	}

	// 6. Delete Project should cascade delete the service
	delPrjReq := httptest.NewRequest(http.MethodDelete, "/api/projects/"+prj.ID, nil)
	delPrjReq.AddCookie(cookie)
	delPrjRec := httptest.NewRecorder()
	r.ServeHTTP(delPrjRec, delPrjReq)
	if delPrjRec.Code != http.StatusOK {
		t.Fatalf("delete project failed: %d", delPrjRec.Code)
	}

	// Verify service is gone
	getSvcReq := httptest.NewRequest(http.MethodGet, "/api/services/"+svc.ID, nil)
	getSvcReq.AddCookie(cookie)
	getSvcRec := httptest.NewRecorder()
	r.ServeHTTP(getSvcRec, getSvcReq)
	if getSvcRec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for cascaded deleted service, got %d", getSvcRec.Code)
	}

	// Now deleting server succeeds
	delSrvReq2 := httptest.NewRequest(http.MethodDelete, "/api/servers/"+srvResp.Server.ID, nil)
	delSrvReq2.AddCookie(cookie)
	delSrvRec2 := httptest.NewRecorder()
	r.ServeHTTP(delSrvRec2, delSrvReq2)
	if delSrvRec2.Code != http.StatusOK {
		t.Fatalf("expected 200 deleting empty server, got %d", delSrvRec2.Code)
	}
}

func TestDomainsAndEncryptedEnvironment(t *testing.T) {
	database, r, cookie := setupTestRouter(t)

	// Setup Server & Project & Service
	serverHost := "10.0.0.1"
	srvBody, _ := json.Marshal(models.CreateServerRequest{Name: "Node-1", Host: &serverHost})
	srvReq := httptest.NewRequest(http.MethodPost, "/api/servers", bytes.NewReader(srvBody))
	srvReq.AddCookie(cookie)
	srvRec := httptest.NewRecorder()
	r.ServeHTTP(srvRec, srvReq)
	var srv models.CreateServerResponse
	_ = json.Unmarshal(srvRec.Body.Bytes(), &srv)

	prjBody, _ := json.Marshal(models.CreateProjectRequest{Name: "Web Project"})
	prjReq := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(prjBody))
	prjReq.AddCookie(cookie)
	prjRec := httptest.NewRecorder()
	r.ServeHTTP(prjRec, prjReq)
	var prj models.Project
	_ = json.Unmarshal(prjRec.Body.Bytes(), &prj)

	svcBody, _ := json.Marshal(models.CreateServiceRequest{
		ProjectID:       prj.ID,
		ServerID:        srv.Server.ID,
		Name:            "web-frontend",
		Repository:      "octopy/web",
		Branch:          "main",
		DockerfilePath:  "Dockerfile",
		InternalPort:    3000,
		HealthCheckPath: "/healthz",
	})
	svcReq := httptest.NewRequest(http.MethodPost, "/api/services", bytes.NewReader(svcBody))
	svcReq.AddCookie(cookie)
	svcRec := httptest.NewRecorder()
	r.ServeHTTP(svcRec, svcReq)
	var svc models.Service
	_ = json.Unmarshal(svcRec.Body.Bytes(), &svc)

	// 1. Add Domain
	domBody, _ := json.Marshal(models.AddDomainRequest{
		Domain: "app.example.com",
	})
	domReq := httptest.NewRequest(http.MethodPost, "/api/services/"+svc.ID+"/domains", bytes.NewReader(domBody))
	domReq.AddCookie(cookie)
	domRec := httptest.NewRecorder()
	r.ServeHTTP(domRec, domReq)

	if domRec.Code != http.StatusCreated {
		t.Fatalf("add domain failed: %d: %s", domRec.Code, domRec.Body.String())
	}
	var dom models.Domain
	_ = json.Unmarshal(domRec.Body.Bytes(), &dom)
	if dom.Domain != "app.example.com" {
		t.Errorf("expected domain 'app.example.com', got %s", dom.Domain)
	}

	// 2. List Domains
	listDomReq := httptest.NewRequest(http.MethodGet, "/api/services/"+svc.ID+"/domains", nil)
	listDomReq.AddCookie(cookie)
	listDomRec := httptest.NewRecorder()
	r.ServeHTTP(listDomRec, listDomReq)
	var domains []models.Domain
	_ = json.Unmarshal(listDomRec.Body.Bytes(), &domains)
	if len(domains) != 1 {
		t.Fatalf("expected 1 domain, got %d", len(domains))
	}

	// 3. Put Environment Variables (including secret)
	envBody, _ := json.Marshal(models.UpdateServiceEnvRequest{
		EnvVars: []models.EnvVar{
			{Key: "NODE_ENV", Value: "production", IsSecret: false},
			{Key: "DATABASE_URL", Value: "postgres://user:supersecretpass@db:5432/app", IsSecret: true},
		},
		BuildArgs: []models.EnvVar{
			{Key: "NEXT_PUBLIC_API_URL", Value: "https://api.example.com", IsSecret: false},
		},
	})
	envReq := httptest.NewRequest(http.MethodPut, "/api/services/"+svc.ID+"/env", bytes.NewReader(envBody))
	envReq.AddCookie(cookie)
	envRec := httptest.NewRecorder()
	r.ServeHTTP(envRec, envReq)

	if envRec.Code != http.StatusOK {
		t.Fatalf("update env failed: %d: %s", envRec.Code, envRec.Body.String())
	}

	// 4. Verify in DB that value is encrypted (NOT stored in plaintext)
	var rawEncryptedVal []byte
	err := database.QueryRow(`SELECT value_encrypted FROM env_vars WHERE service_id = ? AND key = 'DATABASE_URL'`, svc.ID).Scan(&rawEncryptedVal)
	if err != nil {
		t.Fatalf("failed to query raw encrypted env: %v", err)
	}
	if bytes.Contains(rawEncryptedVal, []byte("supersecretpass")) {
		t.Fatal("SECURITY ERROR: secret value was found in plaintext in database!")
	}

	// 5. Get Environment Variables via API (decrypted for authorized admin session with ?reveal=true)
	getEnvReq := httptest.NewRequest(http.MethodGet, "/api/services/"+svc.ID+"/env?reveal=true", nil)
	getEnvReq.AddCookie(cookie)
	getEnvRec := httptest.NewRecorder()
	r.ServeHTTP(getEnvRec, getEnvReq)

	if getEnvRec.Code != http.StatusOK {
		t.Fatalf("get env failed: %d", getEnvRec.Code)
	}
	var serviceEnv models.ServiceEnv
	_ = json.Unmarshal(getEnvRec.Body.Bytes(), &serviceEnv)
	if len(serviceEnv.EnvVars) != 2 || len(serviceEnv.BuildArgs) != 1 {
		t.Fatalf("invalid env count: %+v", serviceEnv)
	}

	var foundSecretVal string
	for _, ev := range serviceEnv.EnvVars {
		if ev.Key == "DATABASE_URL" {
			foundSecretVal = ev.Value
		}
	}
	if foundSecretVal != "postgres://user:supersecretpass@db:5432/app" {
		t.Errorf("decrypted secret value mismatch: %q", foundSecretVal)
	}

	// 5.b Check Domain SSL
	checkSSLReq := httptest.NewRequest(http.MethodPost, "/api/services/"+svc.ID+"/domains/"+dom.ID+"/check-ssl", nil)
	checkSSLReq.AddCookie(cookie)
	checkSSLRec := httptest.NewRecorder()
	r.ServeHTTP(checkSSLRec, checkSSLReq)
	if checkSSLRec.Code != http.StatusOK {
		t.Fatalf("check ssl failed: %d: %s", checkSSLRec.Code, checkSSLRec.Body.String())
	}
	var checkedDom models.Domain
	_ = json.Unmarshal(checkSSLRec.Body.Bytes(), &checkedDom)
	if checkedDom.SSLError != nil && strings.Contains(*checkedDom.SSLError, "—") {
		t.Fatalf("ssl error message contains forbidden em dash: %s", *checkedDom.SSLError)
	}

	// 6. Delete Domain
	delDomReq := httptest.NewRequest(http.MethodDelete, "/api/services/"+svc.ID+"/domains/"+dom.ID, nil)
	delDomReq.AddCookie(cookie)
	delDomRec := httptest.NewRecorder()
	r.ServeHTTP(delDomRec, delDomReq)
	if delDomRec.Code != http.StatusOK {
		t.Fatalf("delete domain failed: %d", delDomRec.Code)
	}
}

func TestServerNodeManagerLiveTelemetryAndStatus(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "crud_nm_test.db")

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

	crudHandler := NewHandler(database, masterKey, "localhost")
	nodeManager := nodes.NewNodeManager(database)
	crudHandler.SetNodeManager(nodeManager)

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

	// 1. Create Server -> Pending
	createBody, _ := json.Marshal(models.CreateServerRequest{Name: "Worker-Live"})
	req := httptest.NewRequest(http.MethodPost, "/api/servers", bytes.NewReader(createBody))
	req.AddCookie(sessionCookie)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	var createResp models.CreateServerResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &createResp)
	serverID := createResp.Server.ID

	// 2. Connect via NodeManager -> status online
	ctx := context.Background()
	_, err = nodeManager.RegisterSession(ctx, serverID, nil)
	if err != nil {
		t.Fatalf("RegisterSession failed: %v", err)
	}

	// Record heartbeat
	err = nodeManager.RecordHeartbeat(ctx, serverID, &protocol.Heartbeat{
		CpuPercent:    31.5,
		RamPercent:    65.0,
		DiskPercent:   40.2,
		UptimeSeconds: 1500,
	})
	if err != nil {
		t.Fatalf("RecordHeartbeat failed: %v", err)
	}

	// 3. Query GET /api/servers and check live telemetry
	listReq := httptest.NewRequest(http.MethodGet, "/api/servers", nil)
	listReq.AddCookie(sessionCookie)
	listRec := httptest.NewRecorder()
	r.ServeHTTP(listRec, listReq)

	var servers []models.Server
	_ = json.Unmarshal(listRec.Body.Bytes(), &servers)
	if len(servers) != 1 {
		t.Fatalf("expected 1 server, got %d", len(servers))
	}
	if servers[0].Status != models.ServerOnline {
		t.Fatalf("expected server status 'online', got '%s'", servers[0].Status)
	}
	if servers[0].CPUPercent != 31.5 || servers[0].RAMPercent != 65.0 || servers[0].DiskPercent != 40.2 {
		t.Fatalf("telemetry mismatch in ListServers: %+v", servers[0])
	}

	// 4. Query GET /api/servers/{id}
	getReq := httptest.NewRequest(http.MethodGet, "/api/servers/"+serverID, nil)
	getReq.AddCookie(sessionCookie)
	getRec := httptest.NewRecorder()
	r.ServeHTTP(getRec, getReq)

	var detail models.ServerDetail
	_ = json.Unmarshal(getRec.Body.Bytes(), &detail)
	if detail.Server.Status != models.ServerOnline {
		t.Fatalf("expected status online in GetServer, got '%s'", detail.Server.Status)
	}
	if detail.Server.CPUPercent != 31.5 || detail.Server.RAMPercent != 65.0 || detail.Server.DiskPercent != 40.2 {
		t.Fatalf("telemetry mismatch in GetServer: %+v", detail)
	}

	// 5. Test transition to offline on missed heartbeats
	nodeManager.SetOfflineTimeout(50 * time.Millisecond)
	time.Sleep(60 * time.Millisecond)
	_, _ = database.Exec(`UPDATE servers SET last_heartbeat_at = datetime('now', '-60 seconds') WHERE id = ?`, serverID)
	nodeManager.CheckLiveness(ctx)

	// Check status in GET /api/servers
	listRec2 := httptest.NewRecorder()
	r.ServeHTTP(listRec2, listReq)
	var servers2 []models.Server
	_ = json.Unmarshal(listRec2.Body.Bytes(), &servers2)
	if servers2[0].Status != models.ServerOffline {
		t.Fatalf("expected server status 'offline' after timeout, got '%s'", servers2[0].Status)
	}
}

type mockNodeStream struct {
	grpc.ServerStream
	sentMsg chan *protocol.ServerMessage
}

func (m *mockNodeStream) Send(msg *protocol.ServerMessage) error {
	m.sentMsg <- msg
	return nil
}

func (m *mockNodeStream) Recv() (*protocol.AgentMessage, error) {
	return nil, nil
}

func (m *mockNodeStream) Context() context.Context {
	return context.Background()
}

func TestPruneServerEndpoint(t *testing.T) {
	database, r, sessionCookie := setupTestRouter(t)
	ctx := context.Background()

	// 1. Create server
	createPayload := `{"name": "Prune Node", "host": "192.168.1.50"}`
	createReq := httptest.NewRequest(http.MethodPost, "/api/servers", bytes.NewBufferString(createPayload))
	createReq.AddCookie(sessionCookie)
	createReq.Header.Set("Content-Type", "application/json")
	createRec := httptest.NewRecorder()
	r.ServeHTTP(createRec, createReq)

	var createResp models.CreateServerResponse
	_ = json.Unmarshal(createRec.Body.Bytes(), &createResp)
	serverID := createResp.Server.ID

	nodeManager := nodes.NewNodeManager(database)
	masterKey := crypto.DeriveKey("test-secret-key-32-bytes-long!")
	handlerWithNM := NewHandler(database, masterKey, "localhost")
	handlerWithNM.SetNodeManager(nodeManager)

	r2 := chi.NewRouter()
	r2.Route("/api", func(apiRouter chi.Router) {
		handlerWithNM.RegisterRoutes(apiRouter)
	})

	// 2. Test prune when node is offline -> returns 503
	pruneReq := httptest.NewRequest(http.MethodPost, "/api/servers/"+serverID+"/prune", nil)
	pruneReq.AddCookie(sessionCookie)
	pruneRec := httptest.NewRecorder()
	r2.ServeHTTP(pruneRec, pruneReq)
	if pruneRec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503 when node offline, got %d", pruneRec.Code)
	}

	// 3. Register active session and heartbeat
	mockStream := &mockNodeStream{sentMsg: make(chan *protocol.ServerMessage, 10)}
	_, err := nodeManager.RegisterSession(ctx, serverID, mockStream)
	if err != nil {
		t.Fatalf("RegisterSession failed: %v", err)
	}
	_ = nodeManager.RecordHeartbeat(ctx, serverID, &protocol.Heartbeat{CpuPercent: 10})

	// 4. In goroutine, listen for PruneCommand and respond with TaskAck
	go func() {
		msg := <-mockStream.sentMsg
		if cmd := msg.GetPruneCommand(); cmd != nil {
			nodeManager.HandleTaskAck(&protocol.TaskAck{
				TaskId:         cmd.GetTaskId(),
				Success:        true,
				ReclaimedBytes: 52428800,
			})
		}
	}()

	// 5. Test prune when node is online
	pruneRec2 := httptest.NewRecorder()
	r2.ServeHTTP(pruneRec2, pruneReq)
	if pruneRec2.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d (body: %s)", pruneRec2.Code, pruneRec2.Body.String())
	}

	var pruneResp map[string]any
	_ = json.Unmarshal(pruneRec2.Body.Bytes(), &pruneResp)
	if pruneResp["success"] != true {
		t.Fatalf("expected success true, got: %+v", pruneResp)
	}
	if reclaimed, ok := pruneResp["reclaimed_bytes"].(float64); !ok || int64(reclaimed) != 52428800 {
		t.Fatalf("expected reclaimed_bytes 52428800, got: %v", pruneResp["reclaimed_bytes"])
	}
}

func TestDatabaseServiceProvisioningAndInjection(t *testing.T) {
	_, r, sessionCookie := setupTestRouter(t)

	// 1. Create Server
	createServerPayload := `{"name": "DB Node", "host": "192.168.1.60"}`
	srvReq := httptest.NewRequest(http.MethodPost, "/api/servers", bytes.NewBufferString(createServerPayload))
	srvReq.AddCookie(sessionCookie)
	srvReq.Header.Set("Content-Type", "application/json")
	srvRec := httptest.NewRecorder()
	r.ServeHTTP(srvRec, srvReq)
	if srvRec.Code != http.StatusCreated {
		t.Fatalf("failed to create server: %d (%s)", srvRec.Code, srvRec.Body.String())
	}
	var srvResp models.CreateServerResponse
	_ = json.Unmarshal(srvRec.Body.Bytes(), &srvResp)
	serverID := srvResp.Server.ID

	// 2. Create Project
	createProjPayload := `{"name": "Database App"}`
	projReq := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewBufferString(createProjPayload))
	projReq.AddCookie(sessionCookie)
	projReq.Header.Set("Content-Type", "application/json")
	projRec := httptest.NewRecorder()
	r.ServeHTTP(projRec, projReq)
	if projRec.Code != http.StatusCreated {
		t.Fatalf("failed to create project: %d (%s)", projRec.Code, projRec.Body.String())
	}
	var proj models.Project
	_ = json.Unmarshal(projRec.Body.Bytes(), &proj)
	projectID := proj.ID

	// 3. Create Web Service
	webServicePayload := map[string]any{
		"project_id":   projectID,
		"server_id":    serverID,
		"name":         "Web Frontend",
		"service_type": "web",
		"repository":   "octopy/web",
		"branch":       "main",
	}
	webBody, _ := json.Marshal(webServicePayload)
	webReq := httptest.NewRequest(http.MethodPost, "/api/services", bytes.NewReader(webBody))
	webReq.AddCookie(sessionCookie)
	webReq.Header.Set("Content-Type", "application/json")
	webRec := httptest.NewRecorder()
	r.ServeHTTP(webRec, webReq)
	if webRec.Code != http.StatusCreated {
		t.Fatalf("failed to create web service: %d (%s)", webRec.Code, webRec.Body.String())
	}
	var webService models.Service
	_ = json.Unmarshal(webRec.Body.Bytes(), &webService)

	// 4. Create Postgres Database Service
	dbEngine := "postgres"
	dbServicePayload := map[string]any{
		"project_id":      projectID,
		"server_id":       serverID,
		"name":            "Main Postgres",
		"service_type":    "database",
		"database_engine": dbEngine,
	}
	dbBody, _ := json.Marshal(dbServicePayload)
	dbReq := httptest.NewRequest(http.MethodPost, "/api/services", bytes.NewReader(dbBody))
	dbReq.AddCookie(sessionCookie)
	dbReq.Header.Set("Content-Type", "application/json")
	dbRec := httptest.NewRecorder()
	r.ServeHTTP(dbRec, dbReq)
	if dbRec.Code != http.StatusCreated {
		t.Fatalf("failed to create database service: %d (%s)", dbRec.Code, dbRec.Body.String())
	}
	var dbService models.Service
	_ = json.Unmarshal(dbRec.Body.Bytes(), &dbService)

	if dbService.ServiceType != models.ServiceTypeDatabase {
		t.Fatalf("expected service_type database, got %s", dbService.ServiceType)
	}
	if dbService.DatabaseEngine == nil || *dbService.DatabaseEngine != "postgres" {
		t.Fatalf("expected postgres engine, got %v", dbService.DatabaseEngine)
	}
	if dbService.DatabasePassword == nil || *dbService.DatabasePassword == "" {
		t.Fatal("expected generated database password, got nil or empty")
	}
	if dbService.ConnectionURI == nil || !strings.HasPrefix(*dbService.ConnectionURI, "postgres://") {
		t.Fatalf("expected valid postgres connection URI, got %v", dbService.ConnectionURI)
	}
	if dbService.VolumeName == nil || !strings.HasPrefix(*dbService.VolumeName, "tako_vol_") {
		t.Fatalf("expected volume_name starting with tako_vol_, got %v", dbService.VolumeName)
	}

	// 5. Test GetService detail
	getReq := httptest.NewRequest(http.MethodGet, "/api/services/"+dbService.ID, nil)
	getReq.AddCookie(sessionCookie)
	getRec := httptest.NewRecorder()
	r.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("failed to get service: %d (%s)", getRec.Code, getRec.Body.String())
	}
	var svcDetail models.ServiceDetail
	_ = json.Unmarshal(getRec.Body.Bytes(), &svcDetail)
	if svcDetail.DatabasePassword == nil || *svcDetail.DatabasePassword != *dbService.DatabasePassword {
		t.Fatalf("decrypted password mismatch: got %v, expected %v", svcDetail.DatabasePassword, dbService.DatabasePassword)
	}

	// 6. Test Inject Connection String into Web Service
	injectPayload := models.InjectConnectionStringRequest{
		TargetServiceID: webService.ID,
	}
	injBody, _ := json.Marshal(injectPayload)
	injReq := httptest.NewRequest(http.MethodPost, "/api/services/"+dbService.ID+"/inject-connection-string", bytes.NewReader(injBody))
	injReq.AddCookie(sessionCookie)
	injReq.Header.Set("Content-Type", "application/json")
	injRec := httptest.NewRecorder()
	r.ServeHTTP(injRec, injReq)
	if injRec.Code != http.StatusOK {
		t.Fatalf("failed to inject connection string: %d (%s)", injRec.Code, injRec.Body.String())
	}

	// Verify env var exists on web service
	envListReq := httptest.NewRequest(http.MethodGet, "/api/services/"+webService.ID+"/env?reveal=true", nil)
	envListReq.AddCookie(sessionCookie)
	envListRec := httptest.NewRecorder()
	r.ServeHTTP(envListRec, envListReq)
	if envListRec.Code != http.StatusOK {
		t.Fatalf("failed to list env vars: %d (%s)", envListRec.Code, envListRec.Body.String())
	}
	var svcEnv models.ServiceEnv
	_ = json.Unmarshal(envListRec.Body.Bytes(), &svcEnv)
	var foundDatabaseURL bool
	for _, ev := range svcEnv.EnvVars {
		if ev.Key == "DATABASE_URL" {
			foundDatabaseURL = true
			if ev.Value != *dbService.ConnectionURI {
				t.Fatalf("expected injected value %s, got %s", *dbService.ConnectionURI, ev.Value)
			}
		}
	}
	if !foundDatabaseURL {
		t.Fatal("DATABASE_URL env var not found on target web service")
	}
}

func TestServiceContainerLifecycle(t *testing.T) {
	db, r, sessionCookie := setupTestRouter(t)

	// 1. Create a project
	prjBody, _ := json.Marshal(models.CreateProjectRequest{
		Name: "Lifecycle Project",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(prjBody))
	req.AddCookie(sessionCookie)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("failed to create project: %d (%s)", rec.Code, rec.Body.String())
	}
	var prj models.Project
	_ = json.Unmarshal(rec.Body.Bytes(), &prj)

	// Create a server
	srvBody, _ := json.Marshal(models.CreateServerRequest{
		Name: "Lifecycle Server",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/servers", bytes.NewReader(srvBody))
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("failed to create server: %d (%s)", rec.Code, rec.Body.String())
	}
	var srvResp models.CreateServerResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &srvResp)

	// 2. Create git-based web service
	webType := models.ServiceTypeWeb
	gitSvcBody, _ := json.Marshal(models.CreateServiceRequest{
		ProjectID:       prj.ID,
		ServerID:        srvResp.Server.ID,
		Name:            "git-web-svc",
		ServiceType:     &webType,
		Repository:      "octopy/web",
		Branch:          "main",
		DockerfilePath:  "Dockerfile",
		InternalPort:    3000,
		HealthCheckPath: "/health",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/services", bytes.NewReader(gitSvcBody))
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("failed to create git service: %d (%s)", rec.Code, rec.Body.String())
	}
	var gitSvc models.Service
	_ = json.Unmarshal(rec.Body.Bytes(), &gitSvc)

	// 3. Create database service
	dbType := models.ServiceTypeDatabase
	dbEngine := "postgres"
	dbVersion := "16-alpine"
	dbSvcBody, _ := json.Marshal(models.CreateServiceRequest{
		ProjectID:       prj.ID,
		ServerID:        srvResp.Server.ID,
		Name:            "pg-database",
		ServiceType:     &dbType,
		DatabaseEngine:  &dbEngine,
		DatabaseVersion: &dbVersion,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/services", bytes.NewReader(dbSvcBody))
	req.AddCookie(sessionCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("failed to create db service: %d (%s)", rec.Code, rec.Body.String())
	}
	var dbSvc models.Service
	_ = json.Unmarshal(rec.Body.Bytes(), &dbSvc)

	// 4. Test Redeploy on git service
	redeployReq := httptest.NewRequest(http.MethodPost, "/api/services/"+gitSvc.ID+"/redeploy", nil)
	redeployReq.AddCookie(sessionCookie)
	redeployRec := httptest.NewRecorder()
	r.ServeHTTP(redeployRec, redeployReq)
	if redeployRec.Code != http.StatusAccepted {
		t.Fatalf("expected 202 Accepted on redeploy, got %d (%s)", redeployRec.Code, redeployRec.Body.String())
	}
	var redeployResp models.Deployment
	_ = json.Unmarshal(redeployRec.Body.Bytes(), &redeployResp)
	if redeployResp.ServiceID != gitSvc.ID {
		t.Fatalf("expected deployment service_id %s, got %s", gitSvc.ID, redeployResp.ServiceID)
	}
	if redeployResp.Status != "queued" {
		t.Fatalf("expected deployment status queued, got %s", redeployResp.Status)
	}

	// 5. Test Pull Update on database service
	pullReq := httptest.NewRequest(http.MethodPost, "/api/services/"+dbSvc.ID+"/pull-update", nil)
	pullReq.AddCookie(sessionCookie)
	pullRec := httptest.NewRecorder()
	r.ServeHTTP(pullRec, pullReq)
	if pullRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on pull update, got %d (%s)", pullRec.Code, pullRec.Body.String())
	}
	var pullResp map[string]any
	_ = json.Unmarshal(pullRec.Body.Bytes(), &pullResp)
	if pullResp["updated"] != true {
		t.Fatalf("expected updated=true, got %v", pullResp["updated"])
	}

	// 6. Test Pull Update rejection on git service
	badPullReq := httptest.NewRequest(http.MethodPost, "/api/services/"+gitSvc.ID+"/pull-update", nil)
	badPullReq.AddCookie(sessionCookie)
	badPullRec := httptest.NewRecorder()
	r.ServeHTTP(badPullRec, badPullReq)
	if badPullRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request on pull-update of git service, got %d", badPullRec.Code)
	}

	// 7. Test Delete with options: delete_volumes=true&prune_images=true
	delDbReq := httptest.NewRequest(http.MethodDelete, "/api/services/"+dbSvc.ID+"?delete_volumes=true&prune_images=true", nil)
	delDbReq.AddCookie(sessionCookie)
	delDbRec := httptest.NewRecorder()
	r.ServeHTTP(delDbRec, delDbReq)
	if delDbRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on delete db service, got %d (%s)", delDbRec.Code, delDbRec.Body.String())
	}

	// Verify dbSvc was deleted from database
	var dbCount int
	_ = db.QueryRow("SELECT COUNT(*) FROM services WHERE id = ?", dbSvc.ID).Scan(&dbCount)
	if dbCount != 0 {
		t.Fatalf("expected db service to be deleted from database, found %d", dbCount)
	}

	// 8. Test Delete with options: delete_volumes=false&prune_images=false
	delGitReq := httptest.NewRequest(http.MethodDelete, "/api/services/"+gitSvc.ID+"?delete_volumes=false&prune_images=false", nil)
	delGitReq.AddCookie(sessionCookie)
	delGitRec := httptest.NewRecorder()
	r.ServeHTTP(delGitRec, delGitReq)
	if delGitRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on delete git service, got %d (%s)", delGitRec.Code, delGitRec.Body.String())
	}

	var gitCount int
	_ = db.QueryRow("SELECT COUNT(*) FROM services WHERE id = ?", gitSvc.ID).Scan(&gitCount)
	if gitCount != 0 {
		t.Fatalf("expected git service to be deleted from database, found %d", gitCount)
	}
}

func TestUpdateServiceConfiguration(t *testing.T) {
	db, r, sessionCookie := setupTestRouter(t)

	// 1. Create a project
	prjBody, _ := json.Marshal(models.CreateProjectRequest{
		Name: "Settings Test Project",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(prjBody))
	req.AddCookie(sessionCookie)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("failed to create project: %d", rec.Code)
	}
	var prj models.Project
	_ = json.Unmarshal(rec.Body.Bytes(), &prj)

	// 2. Create a server
	srvID := "srv_settings_test"
	_, err := db.Exec(`INSERT INTO servers (id, name, host, status) VALUES (?, ?, ?, ?)`,
		srvID, "Test Server", "127.0.0.1", "online")
	if err != nil {
		t.Fatalf("failed to seed server: %v", err)
	}

	// 3. Create Web Service with port 3000
	createPayload := map[string]any{
		"project_id":        prj.ID,
		"server_id":         srvID,
		"name":              "Initial Web Service",
		"service_type":      "web",
		"repository":        "octopy/initial",
		"branch":            "main",
		"dockerfile_path":   "Dockerfile",
		"internal_port":     3000,
		"health_check_path": "/healthz",
	}
	createBody, _ := json.Marshal(createPayload)
	cReq := httptest.NewRequest(http.MethodPost, "/api/services", bytes.NewReader(createBody))
	cReq.AddCookie(sessionCookie)
	cReq.Header.Set("Content-Type", "application/json")
	cRec := httptest.NewRecorder()
	r.ServeHTTP(cRec, cReq)
	if cRec.Code != http.StatusCreated {
		t.Fatalf("failed to create service: %d (%s)", cRec.Code, cRec.Body.String())
	}
	var svc models.Service
	_ = json.Unmarshal(cRec.Body.Bytes(), &svc)

	// 4. Update service: change to worker type, port 0, clear health check, set commands
	workerType := models.ServiceTypeWorker
	newName := "Converted Worker"
	newBranch := "feat/worker"
	zeroPort := 0
	emptyHealth := ""
	newCmd := "python worker.py"
	preCmd := "echo pre"
	postCmd := "echo post"
	autoDeploy := true

	updateReq := models.UpdateServiceRequest{
		Name:              &newName,
		ServiceType:       &workerType,
		Branch:            &newBranch,
		InternalPort:      &zeroPort,
		HealthCheckPath:   &emptyHealth,
		Command:           &newCmd,
		PreDeployCommand:  &preCmd,
		PostDeployCommand: &postCmd,
		AutoDeploy:        &autoDeploy,
	}
	upBody, _ := json.Marshal(updateReq)
	pReq := httptest.NewRequest(http.MethodPatch, "/api/services/"+svc.ID, bytes.NewReader(upBody))
	pReq.AddCookie(sessionCookie)
	pReq.Header.Set("Content-Type", "application/json")
	pRec := httptest.NewRecorder()
	r.ServeHTTP(pRec, pReq)

	if pRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on update, got %d (%s)", pRec.Code, pRec.Body.String())
	}

	var updated models.Service
	_ = json.Unmarshal(pRec.Body.Bytes(), &updated)

	if updated.Name != newName {
		t.Errorf("expected name %q, got %q", newName, updated.Name)
	}
	if updated.ServiceType != models.ServiceTypeWorker {
		t.Errorf("expected service_type worker, got %s", updated.ServiceType)
	}
	if updated.Branch != newBranch {
		t.Errorf("expected branch %q, got %q", newBranch, updated.Branch)
	}
	if updated.InternalPort != 0 {
		t.Errorf("expected internal_port 0, got %d", updated.InternalPort)
	}
	if updated.HealthCheckPath != "" {
		t.Errorf("expected empty health_check_path, got %q", updated.HealthCheckPath)
	}
	if updated.Command == nil || *updated.Command != newCmd {
		t.Errorf("expected command %q, got %v", newCmd, updated.Command)
	}
	if updated.PreDeployCommand == nil || *updated.PreDeployCommand != preCmd {
		t.Errorf("expected pre_deploy_command %q, got %v", preCmd, updated.PreDeployCommand)
	}
	if updated.PostDeployCommand == nil || *updated.PostDeployCommand != postCmd {
		t.Errorf("expected post_deploy_command %q, got %v", postCmd, updated.PostDeployCommand)
	}
	if !updated.AutoDeploy {
		t.Errorf("expected auto_deploy true")
	}

	// 5. Verify persisted in DB via GetService
	gReq := httptest.NewRequest(http.MethodGet, "/api/services/"+svc.ID, nil)
	gReq.AddCookie(sessionCookie)
	gRec := httptest.NewRecorder()
	r.ServeHTTP(gRec, gReq)
	if gRec.Code != http.StatusOK {
		t.Fatalf("failed to get service: %d (%s)", gRec.Code, gRec.Body.String())
	}
	var fetched models.ServiceDetail
	_ = json.Unmarshal(gRec.Body.Bytes(), &fetched)

	if fetched.ServiceType != models.ServiceTypeWorker {
		t.Errorf("expected persisted service_type worker, got %s", fetched.ServiceType)
	}
	if fetched.InternalPort != 0 {
		t.Errorf("expected persisted internal_port 0, got %d", fetched.InternalPort)
	}
}
