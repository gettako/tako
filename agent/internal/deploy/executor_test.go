package deploy_test

import (
	"context"
	"sync"
	"testing"

	"gettako.dev/tako/agent/internal/deploy"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
	"google.golang.org/grpc"
)

type mockDeployStream struct {
	grpc.ServerStream
	mu     sync.Mutex
	chunks []*takov1.DeployLogChunk
}

func (m *mockDeployStream) Send(chunk *takov1.DeployLogChunk) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.chunks = append(m.chunks, chunk)
	return nil
}

func (m *mockDeployStream) Context() context.Context {
	return context.Background()
}

func TestExecuteDeploy(t *testing.T) {
	executor := deploy.NewExecutor(nil) // nil docker client for simulated run

	stream := &mockDeployStream{}
	req := &takov1.DeployRequest{
		DeploymentId: "dep-test-1",
		ServiceId:    "srv-test-1",
		ServiceName:  "web-service",
		Repository:   "https://github.com/gettako/sample-app",
		Branch:       "main",
		CommitHash:   "abc1234",
		Dockerfile:   "Dockerfile",
		Image:        "sample-app:latest",
		Ports:        []int32{3000},
		Domains:      []string{"app.example.com"},
	}

	err := executor.ExecuteDeploy(context.Background(), req, stream)
	if err != nil {
		t.Fatalf("ExecuteDeploy failed: %v", err)
	}

	stream.mu.Lock()
	chunks := stream.chunks
	stream.mu.Unlock()

	if len(chunks) < 4 {
		t.Fatalf("expected at least 4 log chunks, got %d", len(chunks))
	}

	lastChunk := chunks[len(chunks)-1]
	if lastChunk.GetStep() != "Live" {
		t.Errorf("expected final step Live, got %s", lastChunk.GetStep())
	}
}
