package tests

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	"gettako.dev/tako/server/agentgrpc"
	"gettako.dev/tako/server/auth"
	"gettako.dev/tako/server/db"
	"gettako.dev/tako/server/deploy"
	"gettako.dev/tako/server/handlers"
	"gettako.dev/tako/server/nodes"
	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
)

// dynamicProxy models Traefik's zero-downtime atomic backend routing switchover.
type dynamicProxy struct {
	mu     sync.RWMutex
	target string
}

func (p *dynamicProxy) SetTarget(target string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.target = target
}

func (p *dynamicProxy) GetTarget() string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.target
}

func (p *dynamicProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	target := p.GetTarget()
	if target == "" {
		http.Error(w, "Bad Gateway: no active container backend", http.StatusBadGateway)
		return
	}
	targetURL, err := url.Parse(target)
	if err != nil {
		http.Error(w, "Internal Proxy Error", http.StatusInternalServerError)
		return
	}
	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	proxy.ServeHTTP(w, r)
}

func TestE2EDeploymentLifecycle(t *testing.T) {
	// -------------------------------------------------------------------------
	// Setup: Database, Orchestrator, NodeManager, gRPC Agent Server, HTTP API
	// -------------------------------------------------------------------------
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "e2e_lifecycle.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	masterKey := crypto.DeriveKey("e2e-master-secret-key-32-bytes!!")
	nodeManager := nodes.NewNodeManager(database)
	orchestrator := deploy.NewOrchestrator(database, nodeManager, masterKey)

	// 1. gRPC Server for Node Agent communication
	grpcServer, grpcLis, err := agentgrpc.StartGRPCServer("0", database, "localhost", nodeManager, orchestrator)
	if err != nil {
		t.Fatalf("failed to start gRPC server: %v", err)
	}
	go func() {
		_ = grpcServer.Serve(grpcLis)
	}()
	t.Cleanup(grpcServer.Stop)

	// 2. HTTP Control Plane Server
	authHandler, err := auth.NewHandler(database, "localhost")
	if err != nil {
		t.Fatalf("failed to create auth handler: %v", err)
	}
	apiHandler := handlers.NewHandler(database, masterKey, "localhost")
	apiHandler.SetNodeManager(nodeManager)
	apiHandler.SetOrchestrator(orchestrator)

	router := chi.NewRouter()
	router.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	router.Route("/api/auth", func(r chi.Router) {
		authHandler.RegisterRoutes(r)
	})
	router.Route("/api", func(r chi.Router) {
		apiHandler.RegisterRoutes(r)
	})

	apiServer := httptest.NewServer(router)
	t.Cleanup(apiServer.Close)

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("failed to create cookie jar: %v", err)
	}
	httpClient := &http.Client{
		Jar:     jar,
		Timeout: 10 * time.Second,
	}

	// -------------------------------------------------------------------------
	// Step 1: Authentication (Login and session acquisition)
	// -------------------------------------------------------------------------
	t.Log("==> Step 1: Authentication")
	loginBody, _ := json.Marshal(auth.LoginRequest{
		Password: "AdminPassword123!",
	})
	loginResp, err := httpClient.Post(apiServer.URL+"/api/auth/login", "application/json", bytes.NewReader(loginBody))
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	defer loginResp.Body.Close()

	if loginResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(loginResp.Body)
		t.Fatalf("login expected status 200, got %d: %s", loginResp.StatusCode, string(body))
	}

	var authData auth.LoginResponse
	if err := json.NewDecoder(loginResp.Body).Decode(&authData); err != nil {
		t.Fatalf("failed to decode login response: %v", err)
	}
	if authData.User == nil || authData.User.ID != "usr_admin" {
		t.Fatalf("expected usr_admin, got %+v", authData.User)
	}

	// Verify session was set in cookies
	u, _ := url.Parse(apiServer.URL)
	cookies := jar.Cookies(u)
	var hasSessionCookie bool
	for _, c := range cookies {
		if c.Name == "tako_session" && c.Value != "" {
			hasSessionCookie = true
			break
		}
	}
	if !hasSessionCookie {
		t.Fatal("expected tako_session cookie after login")
	}

	// -------------------------------------------------------------------------
	// Step 2: Server Enrollment (One-time token, handshake & transition to online)
	// -------------------------------------------------------------------------
	t.Log("==> Step 2: Server Enrollment")
	createSrvBody, _ := json.Marshal(models.CreateServerRequest{
		Name: "Production Node Alpha",
	})
	createSrvResp, err := httpClient.Post(apiServer.URL+"/api/servers", "application/json", bytes.NewReader(createSrvBody))
	if err != nil {
		t.Fatalf("create server request failed: %v", err)
	}
	defer createSrvResp.Body.Close()

	if createSrvResp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(createSrvResp.Body)
		t.Fatalf("create server expected 201, got %d: %s", createSrvResp.StatusCode, string(body))
	}

	var srvCreated models.CreateServerResponse
	if err := json.NewDecoder(createSrvResp.Body).Decode(&srvCreated); err != nil {
		t.Fatalf("failed to decode create server response: %v", err)
	}
	serverID := srvCreated.Server.ID
	enrollmentToken := srvCreated.EnrollmentToken
	if serverID == "" || enrollmentToken == "" {
		t.Fatalf("invalid server response: %+v", srvCreated)
	}

	// Connect Agent over gRPC
	grpcConn, err := grpc.NewClient(grpcLis.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("failed to dial gRPC: %v", err)
	}
	t.Cleanup(func() { _ = grpcConn.Close() })

	agentClient := protocol.NewAgentServiceClient(grpcConn)

	// Agent enrolls with one-time token
	enrollResp, err := agentClient.Enroll(context.Background(), &protocol.EnrollRequest{
		Token:         enrollmentToken,
		Hostname:      "prod-worker-alpha",
		AgentVersion:  "v1.0.0",
		DockerVersion: "26.1.0",
		OsInfo:        "linux/amd64",
	})
	if err != nil {
		t.Fatalf("agent enrollment failed: %v", err)
	}
	if enrollResp.NodeId != serverID {
		t.Fatalf("expected enrolled node_id %s, got %s", serverID, enrollResp.NodeId)
	}
	if enrollResp.NodeSecret == "" {
		t.Fatal("expected non-empty node secret")
	}

	// Open streaming session
	agentCtx, cancelAgent := context.WithCancel(context.Background())
	t.Cleanup(cancelAgent)

	authCtx := metadata.NewOutgoingContext(agentCtx, metadata.Pairs(
		"x-tako-node-id", enrollResp.NodeId,
		"x-tako-node-secret", enrollResp.NodeSecret,
	))

	stream, err := agentClient.StreamNodeSession(authCtx)
	if err != nil {
		t.Fatalf("StreamNodeSession failed: %v", err)
	}

	// Send initial heartbeat
	err = stream.Send(&protocol.AgentMessage{
		NodeId: serverID,
		Payload: &protocol.AgentMessage_Heartbeat{
			Heartbeat: &protocol.Heartbeat{
				CpuPercent:    14.2,
				RamPercent:    38.5,
				DiskPercent:   24.0,
				UptimeSeconds: 14400,
				Timestamp:     time.Now().Unix(),
			},
		},
	})
	if err != nil {
		t.Fatalf("failed to send heartbeat: %v", err)
	}

	// Receive HeartbeatAck
	ackMsg, err := stream.Recv()
	if err != nil {
		t.Fatalf("failed to receive heartbeat ack: %v", err)
	}
	if ackMsg.GetHeartbeatAck() == nil {
		t.Fatalf("expected HeartbeatAck, got %+v", ackMsg)
	}

	// Verify server status through REST API is now online with metrics
	getSrvResp, err := httpClient.Get(apiServer.URL + "/api/servers/" + serverID)
	if err != nil {
		t.Fatalf("get server failed: %v", err)
	}
	defer getSrvResp.Body.Close()
	var srvDetail models.ServerDetail
	if err := json.NewDecoder(getSrvResp.Body).Decode(&srvDetail); err != nil {
		t.Fatalf("failed to decode server detail: %v", err)
	}
	if srvDetail.Status != models.ServerOnline {
		t.Fatalf("expected server status 'online', got '%s'", srvDetail.Status)
	}
	if srvDetail.CPUPercent != 14.2 || srvDetail.RAMPercent != 38.5 {
		t.Fatalf("expected metrics 14.2/38.5, got %v/%v", srvDetail.CPUPercent, srvDetail.RAMPercent)
	}

	// -------------------------------------------------------------------------
	// Step 3: Project & Service Creation
	// -------------------------------------------------------------------------
	t.Log("==> Step 3: Project & Service Creation")
	projDesc := "Production web infrastructure"
	createProjBody, _ := json.Marshal(models.CreateProjectRequest{
		Name:        "API Services",
		Description: &projDesc,
	})
	createProjResp, err := httpClient.Post(apiServer.URL+"/api/projects", "application/json", bytes.NewReader(createProjBody))
	if err != nil {
		t.Fatalf("create project request failed: %v", err)
	}
	defer createProjResp.Body.Close()
	var projCreated models.Project
	_ = json.NewDecoder(createProjResp.Body).Decode(&projCreated)
	projectID := projCreated.ID

	createSvcBody, _ := json.Marshal(models.CreateServiceRequest{
		ProjectID:       projectID,
		ServerID:        serverID,
		Name:            "Gateway Service",
		Repository:      "https://github.com/gettako/sample-app",
		Branch:          "main",
		DockerfilePath:  "Dockerfile",
		InternalPort:    8081,
		HealthCheckPath: "/healthz",
	})
	createSvcResp, err := httpClient.Post(apiServer.URL+"/api/services", "application/json", bytes.NewReader(createSvcBody))
	if err != nil {
		t.Fatalf("create service request failed: %v", err)
	}
	defer createSvcResp.Body.Close()
	var svcCreated models.Service
	_ = json.NewDecoder(createSvcResp.Body).Decode(&svcCreated)
	serviceID := svcCreated.ID

	// Attach domain
	domainPort := 8081
	domainBody, _ := json.Marshal(models.AddDomainRequest{
		Domain: "api.gateway.internal",
		Port:   &domainPort,
	})
	domainResp, err := httpClient.Post(apiServer.URL+"/api/services/"+serviceID+"/domains", "application/json", bytes.NewReader(domainBody))
	if err != nil {
		t.Fatalf("create domain request failed: %v", err)
	}
	defer domainResp.Body.Close()
	if domainResp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 for domain creation, got %d", domainResp.StatusCode)
	}

	// Setup Reverse Proxy simulating Traefik dynamic routing
	proxy := &dynamicProxy{}
	proxyServer := httptest.NewServer(proxy)
	t.Cleanup(proxyServer.Close)

	// -------------------------------------------------------------------------
	// Background Agent Worker: Handles DeployJobs and PruneCommands
	// -------------------------------------------------------------------------
	var activeContainers sync.Map // tag -> *httptest.Server

	go func() {
		for {
			msg, recvErr := stream.Recv()
			if recvErr != nil {
				return
			}

			// DeployJob handling
			if job := msg.GetDeployJob(); job != nil {
				if job.IsRollback {
					// Instant Rollback: Switch to rollback image without rebuild
					targetSrv, ok := activeContainers.Load(job.RollbackImageTag)
					if ok {
						proxy.SetTarget(targetSrv.(*httptest.Server).URL)
					}
					_ = stream.Send(&protocol.AgentMessage{
						NodeId: serverID,
						Payload: &protocol.AgentMessage_DeploymentStatus{
							DeploymentStatus: &protocol.DeploymentStatusTransition{
								DeploymentId: job.DeploymentId,
								Status:       "healthy",
								ImageTag:     job.RollbackImageTag,
							},
						},
					})
					continue
				}

				// Fresh Build & Deploy
				version := "v1"
				if strings.Contains(job.CommitSha, "v2") {
					version = "v2"
				}

				// 1. Stream build log chunks
				steps := []struct {
					step string
					log  string
				}{
					{"1/3", "FROM node:20-alpine AS builder"},
					{"2/3", "RUN bun install && bun run build"},
					{"3/3", "Successfully tagged tako-app-gateway:" + version},
				}

				for _, s := range steps {
					_ = stream.Send(&protocol.AgentMessage{
						NodeId: serverID,
						Payload: &protocol.AgentMessage_BuildLog{
							BuildLog: &protocol.BuildLogChunk{
								DeploymentId: job.DeploymentId,
								Step:         s.step,
								LogLine:      s.log,
								Timestamp:    time.Now().UnixNano(),
							},
						},
					})
					time.Sleep(10 * time.Millisecond)
				}

				// 2. Launch mock container HTTP server
				currentVersion := version
				containerMux := http.NewServeMux()
				containerMux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte(`{"status":"ok"}`))
				})
				containerMux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusOK)
					_, _ = fmt.Fprintf(w, `{"version":"%s","status":"healthy"}`, currentVersion)
				})

				containerSrv := httptest.NewServer(containerMux)
				imageTag := "tako-app-gateway:" + version
				activeContainers.Store(imageTag, containerSrv)

				// 3. Health check verification
				hcResp, hcErr := http.Get(containerSrv.URL + "/healthz")
				if hcErr == nil && hcResp.StatusCode == http.StatusOK {
					_ = hcResp.Body.Close()
					// Zero-Downtime cutover: point reverse proxy to healthy container
					proxy.SetTarget(containerSrv.URL)
				}

				// 4. Report healthy status to orchestrator
				_ = stream.Send(&protocol.AgentMessage{
					NodeId: serverID,
					Payload: &protocol.AgentMessage_DeploymentStatus{
						DeploymentStatus: &protocol.DeploymentStatusTransition{
							DeploymentId: job.DeploymentId,
							Status:       "healthy",
							ImageTag:     imageTag,
						},
					},
				})
			}

			// PruneCommand handling
			if pruneCmd := msg.GetPruneCommand(); pruneCmd != nil {
				_ = stream.Send(&protocol.AgentMessage{
					NodeId: serverID,
					Payload: &protocol.AgentMessage_TaskAck{
						TaskAck: &protocol.TaskAck{
							TaskId:         pruneCmd.TaskId,
							Success:        true,
							ReclaimedBytes: 1542000000,
							Message:        "Pruned unreferenced build cache and dangling images",
						},
					},
				})
			}
		}
	}()

	// -------------------------------------------------------------------------
	// Step 4: Build & Live SSE Log Streaming
	// -------------------------------------------------------------------------
	t.Log("==> Step 4: Build & Live SSE Log Streaming")
	branch := "main"
	commit1 := "sha_commit_v1"
	triggerDepBody, _ := json.Marshal(models.CreateDeploymentRequest{
		Branch:    &branch,
		CommitSHA: &commit1,
	})
	triggerResp, err := httpClient.Post(apiServer.URL+"/api/services/"+serviceID+"/deployments", "application/json", bytes.NewReader(triggerDepBody))
	if err != nil {
		t.Fatalf("trigger deployment failed: %v", err)
	}
	defer triggerResp.Body.Close()

	if triggerResp.StatusCode != http.StatusAccepted {
		t.Fatalf("expected 202 Accepted, got %d", triggerResp.StatusCode)
	}

	var dep1 models.Deployment
	if err := json.NewDecoder(triggerResp.Body).Decode(&dep1); err != nil {
		t.Fatalf("failed to decode deployment: %v", err)
	}

	// Connect to SSE stream
	sseReq, _ := http.NewRequest(http.MethodGet, apiServer.URL+"/api/services/"+serviceID+"/logs/build?deployment_id="+dep1.ID, nil)
	sseResp, err := httpClient.Do(sseReq)
	if err != nil {
		t.Fatalf("SSE connection failed: %v", err)
	}
	defer sseResp.Body.Close()

	if sseResp.StatusCode != http.StatusOK {
		t.Fatalf("expected SSE 200, got %d", sseResp.StatusCode)
	}

	reader := bufio.NewReader(sseResp.Body)
	var observedBuildStep, observedBuildLog, observedBuildComplete bool

	sseDeadline := time.After(3 * time.Second)
	for !observedBuildComplete {
		select {
		case <-sseDeadline:
			t.Fatal("timed out waiting for live SSE build log events")
		default:
			line, err := reader.ReadString('\n')
			if err != nil {
				break
			}
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "data:") {
				dataJSON := strings.TrimPrefix(line, "data:")
				dataJSON = strings.TrimSpace(dataJSON)
				var evt models.BuildLogStreamEvent
				if err := json.Unmarshal([]byte(dataJSON), &evt); err == nil {
					if evt.Event == "build_step" {
						observedBuildStep = true
					}
					if evt.Event == "build_log" && strings.Contains(evt.Line, "FROM node") {
						observedBuildLog = true
					}
					if evt.Event == "build_complete" && evt.Status == "success" {
						observedBuildComplete = true
					}
				}
			}
		}
	}

	if !observedBuildStep {
		t.Error("expected to observe build_step SSE event")
	}
	if !observedBuildLog {
		t.Error("expected to observe build_log SSE event with compiler output")
	}
	if !observedBuildComplete {
		t.Error("expected to observe build_complete SSE event")
	}

	// Verify service is running with active deployment
	getSvcResp, _ := httpClient.Get(apiServer.URL + "/api/services/" + serviceID)
	var svcStatus models.Service
	_ = json.NewDecoder(getSvcResp.Body).Decode(&svcStatus)
	getSvcResp.Body.Close()
	if svcStatus.Status != models.ServiceRunning {
		t.Fatalf("expected service status running, got %s", svcStatus.Status)
	}
	if svcStatus.ActiveDeploymentID == nil || *svcStatus.ActiveDeploymentID != dep1.ID {
		t.Fatalf("expected active_deployment_id %s, got %v", dep1.ID, svcStatus.ActiveDeploymentID)
	}

	// -------------------------------------------------------------------------
	// Step 5: Health Check & Routing
	// -------------------------------------------------------------------------
	t.Log("==> Step 5: Health Check & Routing")
	routeReq, _ := http.NewRequest(http.MethodGet, proxyServer.URL+"/", nil)
	routeReq.Host = "api.gateway.internal"
	routeResp, err := http.DefaultClient.Do(routeReq)
	if err != nil {
		t.Fatalf("routing request failed: %v", err)
	}
	defer routeResp.Body.Close()

	if routeResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 from routed service, got %d", routeResp.StatusCode)
	}
	var routeData map[string]string
	_ = json.NewDecoder(routeResp.Body).Decode(&routeData)
	if routeData["version"] != "v1" || routeData["status"] != "healthy" {
		t.Fatalf("expected version v1 and status healthy, got %+v", routeData)
	}

	// -------------------------------------------------------------------------
	// Step 6: Zero-Downtime Verification (Hot deployment under load)
	// -------------------------------------------------------------------------
	t.Log("==> Step 6: Zero-Downtime Verification")
	var (
		totalRequests      int64
		successfulRequests int64
		failedRequests     int64
		v1Count            int64
		v2Count            int64
		stopLoad           int32
	)

	// Continuous traffic generator running during swap
	var loadWg sync.WaitGroup
	for w := 0; w < 4; w++ {
		loadWg.Add(1)
		go func() {
			defer loadWg.Done()
			client := &http.Client{Timeout: 500 * time.Millisecond}
			for atomic.LoadInt32(&stopLoad) == 0 {
				req, _ := http.NewRequest(http.MethodGet, proxyServer.URL+"/", nil)
				req.Host = "api.gateway.internal"
				resp, err := client.Do(req)
				atomic.AddInt64(&totalRequests, 1)
				if err != nil || resp.StatusCode != http.StatusOK {
					atomic.AddInt64(&failedRequests, 1)
				} else {
					atomic.AddInt64(&successfulRequests, 1)
					var data map[string]string
					if err := json.NewDecoder(resp.Body).Decode(&data); err == nil {
						if data["version"] == "v1" {
							atomic.AddInt64(&v1Count, 1)
						} else if data["version"] == "v2" {
							atomic.AddInt64(&v2Count, 1)
						}
					}
					_ = resp.Body.Close()
				}
				time.Sleep(5 * time.Millisecond)
			}
		}()
	}

	// Trigger second deployment (v2) while traffic is flowing
	commit2 := "sha_commit_v2"
	dep2Body, _ := json.Marshal(models.CreateDeploymentRequest{
		Branch:    &branch,
		CommitSHA: &commit2,
	})
	dep2Resp, err := httpClient.Post(apiServer.URL+"/api/services/"+serviceID+"/deployments", "application/json", bytes.NewReader(dep2Body))
	if err != nil {
		t.Fatalf("deployment 2 request failed: %v", err)
	}
	var dep2 models.Deployment
	_ = json.NewDecoder(dep2Resp.Body).Decode(&dep2)
	dep2Resp.Body.Close()

	// Wait until deployment 2 becomes active
	for i := 0; i < 50; i++ {
		time.Sleep(20 * time.Millisecond)
		var checkSvc models.Service
		res, _ := httpClient.Get(apiServer.URL + "/api/services/" + serviceID)
		_ = json.NewDecoder(res.Body).Decode(&checkSvc)
		res.Body.Close()
		if checkSvc.ActiveDeploymentID != nil && *checkSvc.ActiveDeploymentID == dep2.ID {
			// Let traffic flow across the active cutover
			time.Sleep(100 * time.Millisecond)
			break
		}
	}

	// Stop traffic generator
	atomic.StoreInt32(&stopLoad, 1)
	loadWg.Wait()

	t.Logf("Zero-Downtime Metrics: total=%d, success=%d, failed=%d, v1=%d, v2=%d",
		totalRequests, successfulRequests, failedRequests, v1Count, v2Count)

	if totalRequests < 50 {
		t.Fatalf("expected at least 50 requests under load, got %d", totalRequests)
	}
	if failedRequests > 0 {
		t.Fatalf("zero-downtime violated: observed %d dropped/failed requests out of %d", failedRequests, totalRequests)
	}
	if v1Count == 0 || v2Count == 0 {
		t.Fatalf("expected traffic to transition across versions: v1=%d, v2=%d", v1Count, v2Count)
	}

	// -------------------------------------------------------------------------
	// Step 7: Instant Rollback (< 5 seconds container swap without rebuild)
	// -------------------------------------------------------------------------
	t.Log("==> Step 7: Instant Rollback")
	rollbackStart := time.Now()

	rbResp, err := httpClient.Post(apiServer.URL+"/api/services/"+serviceID+"/deployments/"+dep1.ID+"/rollback", "application/json", nil)
	if err != nil {
		t.Fatalf("rollback request failed: %v", err)
	}
	defer rbResp.Body.Close()

	if rbResp.StatusCode != http.StatusAccepted {
		body, _ := io.ReadAll(rbResp.Body)
		t.Fatalf("rollback expected 202 Accepted, got %d: %s", rbResp.StatusCode, string(body))
	}

	var rollbackDep models.Deployment
	_ = json.NewDecoder(rbResp.Body).Decode(&rollbackDep)

	// Poll until rollback deployment is completed
	for i := 0; i < 40; i++ {
		time.Sleep(25 * time.Millisecond)
		var checkSvc models.Service
		res, _ := httpClient.Get(apiServer.URL + "/api/services/" + serviceID)
		_ = json.NewDecoder(res.Body).Decode(&checkSvc)
		res.Body.Close()
		if checkSvc.ActiveDeploymentID != nil && *checkSvc.ActiveDeploymentID == rollbackDep.ID {
			break
		}
	}

	rollbackDuration := time.Since(rollbackStart)
	t.Logf("Rollback completed in %v", rollbackDuration)

	if rollbackDuration > 5*time.Second {
		t.Fatalf("rollback exceeded 5 second requirement: took %v", rollbackDuration)
	}

	// Verify route returns v1 again
	rbRouteReq, _ := http.NewRequest(http.MethodGet, proxyServer.URL+"/", nil)
	rbRouteReq.Host = "api.gateway.internal"
	rbRouteResp, err := http.DefaultClient.Do(rbRouteReq)
	if err != nil {
		t.Fatalf("rollback routing request failed: %v", err)
	}
	defer rbRouteResp.Body.Close()
	var rbData map[string]string
	_ = json.NewDecoder(rbRouteResp.Body).Decode(&rbData)
	if rbData["version"] != "v1" {
		t.Fatalf("expected version v1 after rollback, got %s", rbData["version"])
	}

	// -------------------------------------------------------------------------
	// Step 8: Docker Prune (Dangling images cleaned, active preserved)
	// -------------------------------------------------------------------------
	t.Log("==> Step 8: Docker Prune")
	pruneResp, err := httpClient.Post(apiServer.URL+"/api/servers/"+serverID+"/prune", "application/json", nil)
	if err != nil {
		t.Fatalf("prune request failed: %v", err)
	}
	defer pruneResp.Body.Close()

	if pruneResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(pruneResp.Body)
		t.Fatalf("prune expected 200, got %d: %s", pruneResp.StatusCode, string(body))
	}

	var pruneData map[string]any
	if err := json.NewDecoder(pruneResp.Body).Decode(&pruneData); err != nil {
		t.Fatalf("failed to decode prune response: %v", err)
	}

	if pruneData["success"] != true {
		t.Fatalf("expected prune success true, got %v", pruneData["success"])
	}
	reclaimed, ok := pruneData["reclaimed_bytes"].(float64)
	if !ok || int64(reclaimed) <= 0 {
		t.Fatalf("expected reclaimed_bytes > 0, got %v", pruneData["reclaimed_bytes"])
	}
	t.Logf("Docker prune successfully freed %d bytes of dangling images and build cache", int64(reclaimed))
}
