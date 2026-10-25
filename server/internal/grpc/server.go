// Package grpc provides the Tako master gRPC server implementation for agent communications,
// including registration, heartbeat metric updates, and bidirectional task streaming.
package grpc

import (
	"context"
	"strings"
	"sync"
	"time"

	"gettako.dev/tako/internal/orchestrator"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/status"
)

// ServerConfig configures gRPC listeners with orchestrator handles and enrollment secrets.
type ServerConfig struct {
	AgentSecret  string
	Orchestrator *orchestrator.Orchestrator
	MasterNodeID string
}

// AgentHandler implements takov1.AgentServiceServer for agent handshakes,
// telemetry ingestion, and dispatching execution tasks.
type AgentHandler struct {
	takov1.UnimplementedAgentServiceServer
	orchestrator *orchestrator.Orchestrator
	masterNodeID string
	tokenStore   map[string]string
	tokenStoreMu sync.RWMutex
}

// RegisterNode authenticates agent enroll tokens and provisions permanent node auth tokens.
func (h *AgentHandler) RegisterNode(ctx context.Context, req *takov1.RegisterNodeRequest) (*takov1.RegisterNodeResponse, error) {
	if h.orchestrator != nil {
		return h.orchestrator.RegisterNode(ctx, req)
	}
	masterID := h.masterNodeID
	if masterID == "" {
		masterID = "tako-master-01"
	}
	isMasterNode := req.GetNodeId() == masterID || req.GetName() == masterID
	if req.GetRole() == "leader" && !isMasterNode {
		return nil, status.Error(codes.PermissionDenied, "cannot register node with leader role")
	}
	token := "tako-agent-" + req.GetNodeId() + "-token"
	h.tokenStoreMu.Lock()
	if h.tokenStore != nil {
		h.tokenStore[token] = req.GetNodeId()
	}
	h.tokenStoreMu.Unlock()
	return &takov1.RegisterNodeResponse{
		NodeId:       req.GetNodeId(),
		Status:       "registered",
		RegisteredAt: time.Now().UTC().Format(time.RFC3339),
		AuthToken:    token,
	}, nil
}

// Heartbeat handles incoming metrics from worker nodes and persists them to SQLite.
func (h *AgentHandler) Heartbeat(ctx context.Context, req *takov1.HeartbeatRequest) (*takov1.HeartbeatResponse, error) {
	callerNode, _ := ctx.Value(nodeAuthKey{}).(string)
	if callerNode != "" && callerNode != "master" && callerNode != req.GetNodeId() {
		return nil, status.Errorf(codes.PermissionDenied, "authenticated node %s cannot send heartbeat for %s", callerNode, req.GetNodeId())
	}
	if h.orchestrator != nil {
		return h.orchestrator.Heartbeat(ctx, req)
	}
	return &takov1.HeartbeatResponse{
		Acknowledged: true,
		Timestamp:    time.Now().Unix(),
	}, nil
}

// StreamTasks establishes a persistent duplex communication channel with an agent
// to dispatch deployments, terminal commands, and receive execution log chunks.
func (h *AgentHandler) StreamTasks(stream takov1.AgentService_StreamTasksServer) error {
	taskChan := make(chan *takov1.MasterTask, 16)
	var sess *orchestrator.AgentSession
	nodeID := ""

	// Read initial message from agent to learn node ID
	firstMsg, err := stream.Recv()
	if err != nil {
		return err
	}
	nodeID = firstMsg.GetNodeId()
	if nodeID == "" {
		nodeID = "unknown"
	}

	callerNode, _ := stream.Context().Value(nodeAuthKey{}).(string)
	if callerNode != "" && callerNode != "master" && callerNode != nodeID {
		return status.Errorf(codes.PermissionDenied, "authenticated node %s cannot claim session for %s", callerNode, nodeID)
	}

	if h.orchestrator != nil {
		sess = h.orchestrator.RegisterAgentSession(nodeID, taskChan)
		defer h.orchestrator.UnregisterAgentSession(nodeID)
	}

	ctx := stream.Context()
	errChan := make(chan error, 2)

	// Outbound tasks to agent
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case task, ok := <-taskChan:
				if !ok {
					return
				}
				if err := stream.Send(task); err != nil {
					errChan <- err
					return
				}
			}
		}
	}()

	// Inbound task results from agent
	go func() {
		for {
			res, err := stream.Recv()
			if err != nil {
				errChan <- err
				return
			}
			if sess != nil {
				sess.HandleResult(res)
			}
		}
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errChan:
		return err
	}
}

// NewServer initializes and configures a gRPC server with authentication and service stubs.
func NewServer(cfg ServerConfig) *grpc.Server {
	fallbackTokens := make(map[string]string)
	mid := cfg.MasterNodeID
	if mid == "" && cfg.Orchestrator != nil {
		mid = cfg.Orchestrator.MasterNodeID()
	}
	agentHandler := &AgentHandler{
		orchestrator: cfg.Orchestrator,
		masterNodeID: mid,
		tokenStore:   fallbackTokens,
	}

	opts := []grpc.ServerOption{
		grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
			MinTime:             5 * time.Second,
			PermitWithoutStream: true,
		}),
		grpc.KeepaliveParams(keepalive.ServerParameters{
			MaxConnectionIdle: 15 * time.Minute,
			Time:              30 * time.Second,
			Timeout:           5 * time.Second,
		}),
		grpc.UnaryInterceptor(AuthInterceptor(cfg.AgentSecret, cfg.Orchestrator, fallbackTokens)),
		grpc.StreamInterceptor(StreamAuthInterceptor(cfg.AgentSecret, cfg.Orchestrator, fallbackTokens)),
	}

	srv := grpc.NewServer(opts...)

	takov1.RegisterAgentServiceServer(srv, agentHandler)
	takov1.RegisterDeploymentServiceServer(srv, &takov1.UnimplementedDeploymentServiceServer{})
	takov1.RegisterContainerServiceServer(srv, &ContainerHandler{orchestrator: cfg.Orchestrator})

	return srv
}

// ContainerHandler implements takov1.ContainerServiceServer for executing commands
// and streaming container logs via the orchestrator.
type ContainerHandler struct {
	takov1.UnimplementedContainerServiceServer
	orchestrator *orchestrator.Orchestrator
}

// resolveNodeID dynamically determines which worker or leader node hosts the given container.
func (h *ContainerHandler) resolveNodeID(ctx context.Context, containerID string) string {
	if h.orchestrator == nil {
		return ""
	}
	clean := strings.TrimPrefix(containerID, "/")
	slug := clean
	var candidateSlug string
	if strings.HasPrefix(clean, "tako-app-") {
		slug = strings.TrimPrefix(clean, "tako-app-")
		if idx := strings.LastIndex(slug, "-"); idx > 0 {
			candidateSlug = slug[:idx]
		}
	}
	if srvs, err := h.orchestrator.Queries().ListAllServices(ctx); err == nil {
		for _, s := range srvs {
			if (s.Slug == slug || s.Slug == candidateSlug || s.ID == containerID) && s.NodeID != "" {
				return s.NodeID
			}
		}
	}
	return ""
}

// ExecCommand runs a command inside a specified container on a worker node.
func (h *ContainerHandler) ExecCommand(ctx context.Context, req *takov1.ExecCommandRequest) (*takov1.ExecCommandResponse, error) {
	if h.orchestrator == nil {
		return &takov1.ExecCommandResponse{ExitCode: 1, Error: "orchestrator not configured"}, nil
	}
	nodeID := h.resolveNodeID(ctx, req.GetContainerId())
	if nodeID == "" {
		return &takov1.ExecCommandResponse{ExitCode: 1, Error: "target container or host node not found"}, nil
	}
	out, code, err := h.orchestrator.DispatchExec(ctx, nodeID, req.GetContainerId(), req.GetCommand())
	errStr := ""
	if err != nil {
		errStr = err.Error()
	}
	return &takov1.ExecCommandResponse{
		ExitCode: int32(code),
		Output:   out,
		Error:    errStr,
	}, nil
}

// GetContainerLogs retrieves recent log lines from a container on a worker node.
func (h *ContainerHandler) GetContainerLogs(ctx context.Context, req *takov1.GetContainerLogsRequest) (*takov1.ContainerLogsResponse, error) {
	if h.orchestrator == nil {
		return &takov1.ContainerLogsResponse{Error: "orchestrator not configured"}, nil
	}
	tail := int(req.GetTailLines())
	if tail <= 0 {
		tail = 100
	}
	nodeID := h.resolveNodeID(ctx, req.GetContainerId())
	if nodeID == "" {
		return &takov1.ContainerLogsResponse{Error: "target container or host node not found"}, nil
	}
	logs, err := h.orchestrator.DispatchContainerLogs(ctx, nodeID, req.GetContainerId(), tail)
	errStr := ""
	if err != nil {
		errStr = err.Error()
	}
	return &takov1.ContainerLogsResponse{
		Logs:  logs,
		Error: errStr,
	}, nil
}
