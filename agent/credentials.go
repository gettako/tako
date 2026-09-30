package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	"gettako.dev/tako/agent/config"
	"gettako.dev/tako/internal/protocol"
)

type AgentCredentials struct {
	NodeID     string `json:"node_id"`
	NodeSecret string `json:"node_secret"`
	ServerURL  string `json:"server_url"`
}

func loadCredentials(configDir string) (*AgentCredentials, error) {
	credPath := filepath.Join(configDir, "agent.json")
	data, err := os.ReadFile(credPath)
	if err != nil {
		return nil, err
	}

	var creds AgentCredentials
	if err := json.Unmarshal(data, &creds); err != nil {
		return nil, fmt.Errorf("invalid credentials file format: %w", err)
	}

	if creds.NodeID == "" || creds.NodeSecret == "" {
		return nil, errors.New("node_id or node_secret missing in credentials")
	}

	return &creds, nil
}

func saveCredentials(configDir string, creds *AgentCredentials) error {
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	data, err := json.MarshalIndent(creds, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal credentials: %w", err)
	}

	credPath := filepath.Join(configDir, "agent.json")
	if err := os.WriteFile(credPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write credentials file: %w", err)
	}

	return nil
}

func dialServer(serverURL string) (*grpc.ClientConn, error) {
	useTLS := strings.HasPrefix(serverURL, "https://")
	target := strings.TrimPrefix(serverURL, "https://")
	target = strings.TrimPrefix(target, "http://")

	var cred credentials.TransportCredentials
	if useTLS {
		cred = credentials.NewTLS(&tls.Config{MinVersion: tls.VersionTLS12})
	} else {
		cred = insecure.NewCredentials()
	}

	return grpc.NewClient(target, grpc.WithTransportCredentials(cred))
}

func ensureEnrollment(ctx context.Context, cfg *config.Config, dockerVersion string) (*AgentCredentials, error) {
	creds, err := loadCredentials(cfg.ConfigDir)
	if err == nil {
		return creds, nil
	}

	if cfg.EnrollmentToken == "" {
		return nil, fmt.Errorf("no credentials found in %s and TAKO_ENROLLMENT_TOKEN not provided", cfg.ConfigDir)
	}

	hostname, _ := os.Hostname()
	osInfo := fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH)

	var resp *protocol.EnrollResponse
	var lastErr error

	for attempt := 1; attempt <= 15; attempt++ {
		conn, err := dialServer(cfg.ServerURL)
		if err == nil {
			client := protocol.NewAgentServiceClient(conn)
			callCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			resp, err = client.Enroll(callCtx, &protocol.EnrollRequest{
				Token:         cfg.EnrollmentToken,
				Hostname:      hostname,
				AgentVersion:  agentVersion,
				DockerVersion: dockerVersion,
				OsInfo:        osInfo,
			})
			cancel()
			conn.Close()
			if err == nil {
				lastErr = nil
				break
			}
			if st, ok := status.FromError(err); ok {
				if st.Code() == codes.PermissionDenied || st.Code() == codes.InvalidArgument {
					return nil, err
				}
			}
		}
		lastErr = err
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(time.Duration(attempt) * 500 * time.Millisecond):
		}
	}

	if lastErr != nil {
		return nil, fmt.Errorf("enrollment failed after retries: %w", lastErr)
	}

	serverURL := resp.GetServerUrl()
	if serverURL == "" {
		serverURL = cfg.ServerURL
	}

	creds = &AgentCredentials{
		NodeID:     resp.GetNodeId(),
		NodeSecret: resp.GetNodeSecret(),
		ServerURL:  serverURL,
	}

	if err := saveCredentials(cfg.ConfigDir, creds); err != nil {
		return nil, fmt.Errorf("failed to save enrolled credentials: %w", err)
	}

	return creds, nil
}
