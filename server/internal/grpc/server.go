package grpc

import (
	"context"
	"time"

	"gettako.dev/tako/internal/orchestrator"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/keepalive"
)


type ServerConfig struct {
	AgentSecret  string
	Orchestrator *orchestrator.Orchestrator
}

type AgentHandler struct {
	takov1.UnimplementedAgentServiceServer
	orchestrator *orchestrator.Orchestrator
}

func (h *AgentHandler) RegisterNode(ctx context.Context, req *takov1.RegisterNodeRequest) (*takov1.RegisterNodeResponse, error) {
	if h.orchestrator != nil {
		return h.orchestrator.RegisterNode(ctx, req)
	}
	return &takov1.RegisterNodeResponse{
		NodeId:       req.GetNodeId(),
		Status:       "registered",
		RegisteredAt: time.Now().UTC().Format(time.RFC3339),
		AuthToken:    "tako-agent-" + req.GetNodeId(),
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
		grpc.UnaryInterceptor(AuthInterceptor(cfg.AgentSecret)),
		grpc.StreamInterceptor(StreamAuthInterceptor(cfg.AgentSecret)),
	}

	srv := grpc.NewServer(opts...)

	takov1.RegisterAgentServiceServer(srv, &AgentHandler{orchestrator: cfg.Orchestrator})
	takov1.RegisterDeploymentServiceServer(srv, &takov1.UnimplementedDeploymentServiceServer{})
	takov1.RegisterContainerServiceServer(srv, &takov1.UnimplementedContainerServiceServer{})

	return srv
}
