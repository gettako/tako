package deploy_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"gettako.dev/tako/agent/internal/deploy"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

// TestExecuteDeploy_DemoVerifyRepo tests real git clone and deployment lifecycle
// for the official demo repository: https://github.com/supianidz/tako-demo-verify.
func TestExecuteDeploy_DemoVerifyRepo(t *testing.T) {
	executor := deploy.NewExecutor(nil) // nil docker client for simulated runtime
	stream := &mockDeployStream{}

	req := &takov1.DeployRequest{
		DeploymentId: "dep-demo-verify-01",
		ServiceId:    "srv-demo-verify-01",
		ServiceName:  "tako-demo-verify",
		Repository:   "https://github.com/supianidz/tako-demo-verify",
		Branch:       "main",
		Dockerfile:   "Dockerfile",
		Ports:        []int32{8080},
		Domains: []string{
			"demo.gettako.dev",
			"tako-demo-verify.sslip.io",
		},
		EnvVars: map[string]string{
			"APP_ENV":       "production",
			"PORT":          "8080",
			"CUSTOM_SECRET": "takosecret123",
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	err := executor.ExecuteDeploy(ctx, req, stream)
	if err != nil {
		t.Fatalf("ExecuteDeploy for tako-demo-verify failed: %v", err)
	}

	stream.mu.Lock()
	chunks := stream.chunks
	stream.mu.Unlock()

	if len(chunks) < 3 {
		t.Fatalf("expected at least 3 log chunks, got %d", len(chunks))
	}

	// Verify step logs sequence
	stepsSeen := make(map[string]bool)
	var cloneSuccessMsg string
	for _, c := range chunks {
		stepsSeen[c.GetStep()] = true
		if c.GetStep() == "Clone" && strings.Contains(c.GetMessage(), "Successfully cloned") {
			cloneSuccessMsg = c.GetMessage()
		}
	}

	if !stepsSeen["Queued"] {
		t.Errorf("missing Queued step in deployment logs")
	}
	if !stepsSeen["Clone"] {
		t.Errorf("missing Clone step in deployment logs")
	}
	if cloneSuccessMsg == "" {
		t.Errorf("expected successful clone log message for https://github.com/supianidz/tako-demo-verify")
	}
	if !stepsSeen["Live"] {
		t.Errorf("missing Live step in deployment logs")
	}

	lastChunk := chunks[len(chunks)-1]
	if lastChunk.GetStep() != "Live" {
		t.Errorf("expected final step Live, got %s", lastChunk.GetStep())
	}
}
