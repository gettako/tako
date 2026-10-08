package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
	dbStore "gettako.dev/tako/internal/store/db"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func TestNodeTraefikConfigurationAPI(t *testing.T) {
	db, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(db, bus, "test-secret")
	router := NewRouter(db, orch)

	// Register a test node
	regResp, err := orch.RegisterNode(context.Background(), &takov1.RegisterNodeRequest{
		NodeId:        "node-traefik-01",
		Name:          "tako-edge-node",
		IpAddress:     "192.168.1.100",
		CpuTotalCores: 4,
		MemoryTotalMb: 8192,
		DiskTotalGb:   100,
		DockerVersion: "26.1.0",
		Os:            "linux",
		KernelVersion: "6.8.0",
		EnrollToken:   "test-secret",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}
	nodeID := regResp.NodeId

	// 1. GET /api/v1/nodes/{id}/traefik -> returns default config
	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/nodes/"+nodeID+"/traefik", nil)
	getW := httptest.NewRecorder()
	router.ServeHTTP(getW, getReq)
	if getW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for GET node traefik, got %d: %s", getW.Code, getW.Body.String())
	}

	var cfg NodeTraefikConfig
	if err := json.Unmarshal(getW.Body.Bytes(), &cfg); err != nil {
		t.Fatalf("failed to decode node traefik config: %v", err)
	}
	if !cfg.Enabled || cfg.HTTPPort != 80 || cfg.HTTPSPort != 443 {
		t.Errorf("unexpected default traefik config: %+v", cfg)
	}
	if cfg.NodeID != nodeID {
		t.Errorf("expected node ID %s, got %s", nodeID, cfg.NodeID)
	}

	// 2. PUT /api/v1/nodes/{id}/traefik with identical ports -> returns 400
	badPortPayload, _ := json.Marshal(NodeTraefikConfig{
		HTTPPort:  80,
		HTTPSPort: 80, // Identical ports!
	})
	badPortReq := httptest.NewRequest(http.MethodPut, "/api/v1/nodes/"+nodeID+"/traefik", bytes.NewReader(badPortPayload))
	badPortReq.Header.Set("Content-Type", "application/json")
	badPortW := httptest.NewRecorder()
	router.ServeHTTP(badPortW, badPortReq)
	if badPortW.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for identical ports, got %d", badPortW.Code)
	}

	// 3. PUT /api/v1/nodes/{id}/traefik with valid configuration -> returns 200
	validPayload, _ := json.Marshal(NodeTraefikConfig{
		Enabled:          true,
		HTTPPort:         80,
		HTTPSPort:        443,
		DashboardEnabled: true,
		DashboardPort:    8080,
		AcmeEmail:        "ops@mycompany.dev",
		LogLevel:         "DEBUG",
		AccessLogEnabled: true,
		ForceHTTPS:       true,
		DynamicConfigDir: "/etc/tako/traefik/dynamic",
		CertResolver:     "letsencrypt",
		MetricsEnabled:   true,
	})
	putReq := httptest.NewRequest(http.MethodPut, "/api/v1/nodes/"+nodeID+"/traefik", bytes.NewReader(validPayload))
	putReq.Header.Set("Content-Type", "application/json")
	putW := httptest.NewRecorder()
	router.ServeHTTP(putW, putReq)
	if putW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for valid PUT traefik config, got %d: %s", putW.Code, putW.Body.String())
	}

	var updatedCfg NodeTraefikConfig
	if err := json.Unmarshal(putW.Body.Bytes(), &updatedCfg); err != nil {
		t.Fatalf("failed to parse updated config: %v", err)
	}
	if !updatedCfg.DashboardEnabled || updatedCfg.LogLevel != "DEBUG" || updatedCfg.AcmeEmail != "ops@mycompany.dev" {
		t.Errorf("unexpected updated config: %+v", updatedCfg)
	}

	// 4. POST /api/v1/nodes/{id}/traefik/reload -> reloads routing and returns 200
	reloadReq := httptest.NewRequest(http.MethodPost, "/api/v1/nodes/"+nodeID+"/traefik/reload", nil)
	reloadW := httptest.NewRecorder()
	router.ServeHTTP(reloadW, reloadReq)
	if reloadW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for reload traefik, got %d: %s", reloadW.Code, reloadW.Body.String())
	}
	var reloadResp map[string]any
	_ = json.Unmarshal(reloadW.Body.Bytes(), &reloadResp)
	if reloadResp["success"] != true {
		t.Errorf("expected reload success=true, got %v", reloadResp["success"])
	}

	// 5. GET /api/v1/nodes/non-existent-node/traefik -> returns 404
	notFoundReq := httptest.NewRequest(http.MethodGet, "/api/v1/nodes/non-existent/traefik", nil)
	notFoundW := httptest.NewRecorder()
	router.ServeHTTP(notFoundW, notFoundReq)
	if notFoundW.Code != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found for missing node, got %d", notFoundW.Code)
	}

	// 6. Verify audit log was recorded for update and reload
	auditReq := httptest.NewRequest(http.MethodGet, "/api/v1/audit-logs", nil)
	auditW := httptest.NewRecorder()
	router.ServeHTTP(auditW, auditReq)
	if auditW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for audit logs, got %d", auditW.Code)
	}
	var logs []AuditLogResponse
	_ = json.Unmarshal(auditW.Body.Bytes(), &logs)
	hasUpdate := false
	hasReload := false
	for _, l := range logs {
		if l.Action == "update_node_traefik_config" {
			hasUpdate = true
		}
		if l.Action == "reload_node_traefik" {
			hasReload = true
		}
	}
	if !hasUpdate || !hasReload {
		t.Errorf("expected audit logs for update (%v) and reload (%v)", hasUpdate, hasReload)
	}
}

func TestNodeTraefikFilesAPI(t *testing.T) {
	db, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(db, bus, "test-secret")
	router := NewRouter(db, orch)

	regResp, err := orch.RegisterNode(context.Background(), &takov1.RegisterNodeRequest{
		NodeId:        "node-files-01",
		Name:          "tako-files-node",
		IpAddress:     "192.168.1.101",
		CpuTotalCores: 4,
		MemoryTotalMb: 8192,
		DiskTotalGb:   100,
		DockerVersion: "26.1.0",
		Os:            "linux",
		KernelVersion: "6.8.0",
		EnrollToken:   "test-secret",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}
	nodeID := regResp.NodeId

	// 1. GET /api/v1/nodes/{id}/traefik/files -> returns traefik.yml (static config always present, no fake files)
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/nodes/"+nodeID+"/traefik/files", nil)
	listW := httptest.NewRecorder()
	router.ServeHTTP(listW, listReq)
	if listW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for list files, got %d: %s", listW.Code, listW.Body.String())
	}
	var files []TraefikConfigFile
	if err := json.Unmarshal(listW.Body.Bytes(), &files); err != nil {
		t.Fatalf("failed to decode files list: %v", err)
	}
	if len(files) != 1 || files[0].Name != "traefik.yml" {
		t.Fatalf("expected 1 file (traefik.yml) initially, got %d: %+v", len(files), files)
	}
	if files[0].Path != "/etc/tako/traefik/traefik.yml" {
		t.Errorf("expected path /etc/tako/traefik/traefik.yml, got %s", files[0].Path)
	}

	// 2. Assign domain to console via domain_settings -> tako.yml appears alongside traefik.yml
	_, err = orch.Queries().SetSetting(context.Background(), dbStore.SetSettingParams{
		Key:   "domain_settings",
		Value: `{"domain":"console.gettako.dev"}`,
	})
	if err != nil {
		t.Fatalf("failed to set domain_settings: %v", err)
	}

	listReq2 := httptest.NewRequest(http.MethodGet, "/api/v1/nodes/"+nodeID+"/traefik/files", nil)
	listW2 := httptest.NewRecorder()
	router.ServeHTTP(listW2, listReq2)
	if listW2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for list files, got %d: %s", listW2.Code, listW2.Body.String())
	}
	var filesAfterDomain []TraefikConfigFile
	if err := json.Unmarshal(listW2.Body.Bytes(), &filesAfterDomain); err != nil {
		t.Fatalf("failed to decode files list: %v", err)
	}
	if len(filesAfterDomain) != 2 {
		t.Fatalf("expected exactly 2 files (traefik.yml & tako.yml) after domain assignment, got %d", len(filesAfterDomain))
	}
	if filesAfterDomain[0].Name != "traefik.yml" || filesAfterDomain[1].Name != "tako.yml" {
		t.Fatalf("expected [traefik.yml, tako.yml], got [%s, %s]", filesAfterDomain[0].Name, filesAfterDomain[1].Name)
	}

	// Verify traefik.yml cannot be deleted -> 400 Bad Request
	delTraefikReq := httptest.NewRequest(http.MethodDelete, "/api/v1/nodes/"+nodeID+"/traefik/files/traefik.yml", nil)
	delTraefikW := httptest.NewRecorder()
	router.ServeHTTP(delTraefikW, delTraefikReq)
	if delTraefikW.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when attempting to delete traefik.yml, got %d", delTraefikW.Code)
	}

	// Verify tako.yml content contains console.gettako.dev
	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/nodes/"+nodeID+"/traefik/files/tako.yml", nil)
	getW := httptest.NewRecorder()
	router.ServeHTTP(getW, getReq)
	if getW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for get file, got %d", getW.Code)
	}
	var fileContent TraefikConfigFileContent
	if err := json.Unmarshal(getW.Body.Bytes(), &fileContent); err != nil {
		t.Fatalf("failed to decode file content: %v", err)
	}
	if fileContent.Name != "tako.yml" || !strings.Contains(fileContent.Content, "console.gettako.dev") {
		t.Errorf("unexpected file content: %+v", fileContent)
	}

	// 3. Path traversal attack protection -> returns 400 Bad Request
	badReq := httptest.NewRequest(http.MethodGet, "/api/v1/nodes/"+nodeID+"/traefik/files/..%2F..%2Fpasswd.yml", nil)
	badW := httptest.NewRecorder()
	router.ServeHTTP(badW, badReq)
	if badW.Code != http.StatusBadRequest && badW.Code != http.StatusNotFound {
		t.Errorf("expected 400 or 404 for path traversal attempt, got %d", badW.Code)
	}

	// 4. PUT /api/v1/nodes/{id}/traefik/files/custom-routing.yml -> creates new custom dynamic file
	newFilePayload, _ := json.Marshal(SaveTraefikFileRequest{
		Content: "http:\n  routers:\n    custom-app:\n      rule: Host(`api.example.com`)\n      service: custom-svc\n",
	})
	putReq := httptest.NewRequest(http.MethodPut, "/api/v1/nodes/"+nodeID+"/traefik/files/custom-routing.yml", bytes.NewReader(newFilePayload))
	putReq.Header.Set("Content-Type", "application/json")
	putW := httptest.NewRecorder()
	router.ServeHTTP(putW, putReq)
	if putW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for save file, got %d: %s", putW.Code, putW.Body.String())
	}
	var saved TraefikConfigFileContent
	_ = json.Unmarshal(putW.Body.Bytes(), &saved)
	if saved.Name != "custom-routing.yml" || !saved.IsCustom {
		t.Errorf("unexpected saved file item: %+v", saved)
	}

	// 5. DELETE /api/v1/nodes/{id}/traefik/files/custom-routing.yml -> deletes file
	delReq := httptest.NewRequest(http.MethodDelete, "/api/v1/nodes/"+nodeID+"/traefik/files/custom-routing.yml", nil)
	delW := httptest.NewRecorder()
	router.ServeHTTP(delW, delReq)
	if delW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for delete file, got %d: %s", delW.Code, delW.Body.String())
	}

	// 6. Verify file is now deleted (404)
	getDelReq := httptest.NewRequest(http.MethodGet, "/api/v1/nodes/"+nodeID+"/traefik/files/custom-routing.yml", nil)
	getDelW := httptest.NewRecorder()
	router.ServeHTTP(getDelW, getDelReq)
	if getDelW.Code != http.StatusNotFound {
		t.Errorf("expected 404 Not Found after deletion, got %d", getDelW.Code)
	}

	// 7. Verify audit logs recorded save and delete actions
	auditReq := httptest.NewRequest(http.MethodGet, "/api/v1/audit-logs", nil)
	auditW := httptest.NewRecorder()
	router.ServeHTTP(auditW, auditReq)
	var logs []AuditLogResponse
	_ = json.Unmarshal(auditW.Body.Bytes(), &logs)
	hasSaveFile := false
	hasDeleteFile := false
	for _, l := range logs {
		if l.Action == "save_node_traefik_file" {
			hasSaveFile = true
		}
		if l.Action == "delete_node_traefik_file" {
			hasDeleteFile = true
		}
	}
	if !hasSaveFile || !hasDeleteFile {
		t.Errorf("expected audit logs for save (%v) and delete (%v)", hasSaveFile, hasDeleteFile)
	}
}

func TestUpdateNodeEndpoint(t *testing.T) {
	db, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(db, bus, "test-token")
	router := NewRouter(db, orch)

	// Register a node with public IP in both fields initially
	nodeID := "node-spec-test"
	regReq := &takov1.RegisterNodeRequest{
		NodeId:        nodeID,
		Name:          "Initial Name",
		IpAddress:     "43.156.243.241",
		PublicIp:      "43.156.243.241",
		Role:          "worker",
		CpuTotalCores: 4,
		MemoryTotalMb: 7620,
		DiskTotalGb:   100,
		DockerVersion: "26.1.0",
		Os:            "Ubuntu 22.04 LTS",
		KernelVersion: "5.15.0-generic",
		EnrollToken:   "test-token",
	}
	_, err = orch.RegisterNode(context.Background(), regReq)
	if err != nil {
		t.Fatalf("failed to register node: %v", err)
	}

	// Update node with correct private IP
	updatePayload := `{"name":"Tako Worker 01","ip_address":"10.3.19.31","public_ip":"43.156.243.241"}`
	patchReq := httptest.NewRequest(http.MethodPatch, "/api/v1/nodes/"+nodeID, bytes.NewBufferString(updatePayload))
	patchReq.Header.Set("Content-Type", "application/json")
	patchW := httptest.NewRecorder()
	router.ServeHTTP(patchW, patchReq)

	if patchW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for PATCH node, got %d: %s", patchW.Code, patchW.Body.String())
	}

	var res NodeResponse
	if err := json.Unmarshal(patchW.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res.Name != "Tako Worker 01" {
		t.Errorf("expected updated name 'Tako Worker 01', got '%s'", res.Name)
	}
	if res.IPAddress != "10.3.19.31" {
		t.Errorf("expected updated ip_address '10.3.19.31', got '%s'", res.IPAddress)
	}
	if res.PublicIP != "43.156.243.241" {
		t.Errorf("expected public_ip '43.156.243.241', got '%s'", res.PublicIP)
	}
}

func TestRebootNodeEndpoint(t *testing.T) {
	db, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(db, bus, "test-token")
	router := NewRouter(db, orch)

	nodeID := "node-reboot-test"
	regReq := &takov1.RegisterNodeRequest{
		NodeId:        nodeID,
		Name:          "Reboot Target",
		IpAddress:     "10.3.19.31",
		PublicIp:      "43.156.243.241",
		Role:          "worker",
		CpuTotalCores: 4,
		MemoryTotalMb: 7620,
		DiskTotalGb:   100,
		DockerVersion: "26.1.0",
		Os:            "Ubuntu 22.04 LTS",
		KernelVersion: "5.15.0-generic",
		EnrollToken:   "test-token",
	}
	_, err = orch.RegisterNode(context.Background(), regReq)
	if err != nil {
		t.Fatalf("failed to register node: %v", err)
	}

	// POST /api/v1/nodes/{id}/reboot
	rebootReq := httptest.NewRequest(http.MethodPost, "/api/v1/nodes/"+nodeID+"/reboot", nil)
	rebootW := httptest.NewRecorder()
	router.ServeHTTP(rebootW, rebootReq)

	if rebootW.Code != http.StatusOK && rebootW.Code != http.StatusAccepted {
		t.Fatalf("expected 200 or 202 for reboot node, got %d: %s", rebootW.Code, rebootW.Body.String())
	}

	var res map[string]any
	if err := json.Unmarshal(rebootW.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res["success"] != true {
		t.Errorf("expected success: true, got %v", res)
	}

	// Verify node status was transitioned to offline
	updatedNode, err := orch.Queries().GetNodeByID(context.Background(), nodeID)
	if err != nil {
		t.Fatalf("failed to get node: %v", err)
	}
	if updatedNode.Status != "offline" {
		t.Errorf("expected status 'offline', got '%s'", updatedNode.Status)
	}

	// Verify audit log recorded reboot
	auditReq := httptest.NewRequest(http.MethodGet, "/api/v1/audit-logs", nil)
	auditW := httptest.NewRecorder()
	router.ServeHTTP(auditW, auditReq)
	var logs []AuditLogResponse
	_ = json.Unmarshal(auditW.Body.Bytes(), &logs)
	foundRebootAudit := false
	for _, l := range logs {
		if l.Action == "reboot_node" && l.TargetID == nodeID {
			foundRebootAudit = true
		}
	}
	if !foundRebootAudit {
		t.Errorf("expected reboot_node audit log entry")
	}
}
