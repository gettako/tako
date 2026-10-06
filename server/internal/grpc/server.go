package grpc

import (
	"context"
	"time"

	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
	"google.golang.org/grpc"
)

type NodeOrchestrator interface {
	RegisterNode(ctx context.Context, req *takov1.RegisterNodeRequest) (*takov1.RegisterNodeResponse, error)
	Heartbeat(ctx context.Context, req *takov1.HeartbeatRequest) (*takov1.HeartbeatResponse, error)
}

type ServerConfig struct {
	AgentSecret  string
	Orchestrator NodeOrchestrator
}

type AgentHandler struct {
	takov1.UnimplementedAgentServiceServer
	orchestrator NodeOrchestrator
}

func (h *AgentHandler) RegisterNode(ctx context.Context, req *takov1.RegisterNodeRequest) (*takov1.RegisterNodeResponse, error) {
	if h.orchestrator != nil {
		return h.orchestrator.RegisterNode(ctx, req)
	}
	return &takov1.RegisterNodeResponse{
		NodeId:       req.GetNodeId(),
		Status:       "registered",
		RegisteredAt: time.Now().UTC().Format(time.RFC3339),
		AuthToken:    "tako-token-" + req.GetNodeId(),
	}, nil
}

func (h *AgentHandler) Heartbeat(ctx context.Context, req *takov1.HeartbeatRequest) (*takov1.HeartbeatResponse, error) {
	if h.orchestrator != nil {
		return h.orchestrator.Heartbeat(ctx, req)
	}
	return &takov1.HeartbeatResponse{
		Acknowledged: true,
		Timestamp:    time.Now().Unix(),
	}, nil
}

type BaseDeploymentHandler struct {
	takov1.UnimplementedDeploymentServiceServer
}

type BaseContainerHandler struct {
	takov1.UnimplementedContainerServiceServer
}

// NewServer initializes and configures a gRPC server with authentication and service stubs.
func NewServer(cfg ServerConfig) *grpc.Server {
	opts := []grpc.ServerOption{
		grpc.UnaryInterceptor(AuthInterceptor(cfg.AgentSecret)),
		grpc.StreamInterceptor(StreamAuthInterceptor(cfg.AgentSecret)),
	}

	srv := grpc.NewServer(opts...)

	takov1.RegisterAgentServiceServer(srv, &AgentHandler{orchestrator: cfg.Orchestrator})
	takov1.RegisterDeploymentServiceServer(srv, &BaseDeploymentHandler{})
	takov1.RegisterContainerServiceServer(srv, &BaseContainerHandler{})

	return srv
}
