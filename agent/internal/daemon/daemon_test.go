package daemon_test

import (
	"context"
	"net"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"gettako.dev/tako/agent/internal/daemon"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
	"google.golang.org/grpc"
)

type recordingMasterServer struct {
	takov1.UnimplementedAgentServiceServer
	mu             sync.Mutex
	registeredNode string
	heartbeatCount int
}

func (s *recordingMasterServer) RegisterNode(ctx context.Context, req *takov1.RegisterNodeRequest) (*takov1.RegisterNodeResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.registeredNode = req.GetNodeId()
	return &takov1.RegisterNodeResponse{
		NodeId:    req.GetNodeId(),
		Status:    "registered",
		AuthToken: "test-auth-token",
	}, nil
}

func (s *recordingMasterServer) Heartbeat(ctx context.Context, req *takov1.HeartbeatRequest) (*takov1.HeartbeatResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.heartbeatCount++
	return &takov1.HeartbeatResponse{
		Acknowledged: true,
		Timestamp:    time.Now().Unix(),
	}, nil
}

func TestDaemonRegistrationAndHeartbeatLoop(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen: %v", err)
	}
	defer lis.Close()

	srv := grpc.NewServer()
	mock := &recordingMasterServer{}
	takov1.RegisterAgentServiceServer(srv, mock)

	go func() {
		_ = srv.Serve(lis)
	}()
	defer srv.Stop()

	tmpDir := t.TempDir()
	stateFile := filepath.Join(tmpDir, "agent-state.json")

	d, err := daemon.New(daemon.Config{
		MasterURL:         lis.Addr().String(),
		EnrollToken:       "token-test",
		NodeID:            "node-test-daemon",
		NodeName:          "Test Worker",
		Role:              "worker",
		IPAddress:         "127.0.0.1",
		StateFile:         stateFile,
		HeartbeatInterval: 50 * time.Millisecond,
		Insecure:          true,
	})
	if err != nil {
		t.Fatalf("daemon.New failed: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	errCh := make(chan error, 1)
	go func() {
		errCh <- d.Run(ctx)
	}()

	// Wait for at least 2 heartbeats
	assertTimeout := time.After(3 * time.Second)
	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()

	registered := false
	for !registered {
		select {
		case <-assertTimeout:
			t.Fatalf("timed out waiting for registration and heartbeats")
		case <-ticker.C:
			mock.mu.Lock()
			count := mock.heartbeatCount
			node := mock.registeredNode
			mock.mu.Unlock()

			if node == "node-test-daemon" && count >= 2 {
				registered = true
			}
		}
	}

	// Cancel context to test graceful shutdown
	cancel()

	select {
	case err := <-errCh:
		if err != nil {
			t.Errorf("daemon Run returned unexpected error: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("daemon failed to shut down in time")
	}
}
