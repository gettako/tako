package client

import (
	"context"
	"crypto/tls"
	"fmt"
	"sync"
	"time"

	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/metadata"
)

type Config struct {
	ServerAddr string
	AuthToken  string
	Insecure   bool
}

type Client struct {
	mu               sync.RWMutex
	cfg              Config
	conn             *grpc.ClientConn
	agentClient      takov1.AgentServiceClient
	deploymentClient takov1.DeploymentServiceClient
	containerClient  takov1.ContainerServiceClient
}

// New creates and dials a new gRPC client to Tako Master with resilient reconnect backoff.
func New(cfg Config) (*Client, error) {
	c := &Client{cfg: cfg}

	var creds credentials.TransportCredentials
	if cfg.Insecure {
		creds = insecure.NewCredentials()
	} else {
		creds = credentials.NewTLS(&tls.Config{MinVersion: tls.VersionTLS12})
	}

	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(creds),
		grpc.WithConnectParams(grpc.ConnectParams{
			Backoff: backoff.Config{
				BaseDelay:  100 * time.Millisecond,
				Multiplier: 1.6,
				Jitter:     0.2,
				MaxDelay:   5 * time.Second,
			},
			MinConnectTimeout: 5 * time.Second,
		}),
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                15 * time.Second,
			Timeout:             5 * time.Second,
			PermitWithoutStream: true,
		}),
		grpc.WithUnaryInterceptor(c.unaryAuthInterceptor()),
		grpc.WithStreamInterceptor(c.streamAuthInterceptor()),
	}

	conn, err := grpc.NewClient(cfg.ServerAddr, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to dial master %s: %w", cfg.ServerAddr, err)
	}

	c.conn = conn
	c.agentClient = takov1.NewAgentServiceClient(conn)
	c.deploymentClient = takov1.NewDeploymentServiceClient(conn)
	c.containerClient = takov1.NewContainerServiceClient(conn)

	return c, nil
}

func (c *Client) SetAuthToken(token string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cfg.AuthToken = token
}

func (c *Client) getAuthToken() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.cfg.AuthToken
}

func (c *Client) unaryAuthInterceptor() grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply any, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		if token := c.getAuthToken(); token != "" {
			ctx = metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token)
		}
		return invoker(ctx, method, req, reply, cc, opts...)
	}
}

func (c *Client) streamAuthInterceptor() grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		if token := c.getAuthToken(); token != "" {
			ctx = metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token)
		}
		return streamer(ctx, desc, cc, method, opts...)
	}
}

func (c *Client) RegisterNode(ctx context.Context, req *takov1.RegisterNodeRequest) (*takov1.RegisterNodeResponse, error) {
	return c.agentClient.RegisterNode(ctx, req)
}

func (c *Client) Heartbeat(ctx context.Context, req *takov1.HeartbeatRequest) (*takov1.HeartbeatResponse, error) {
	return c.agentClient.Heartbeat(ctx, req)
}

func (c *Client) AgentClient() takov1.AgentServiceClient {
	return c.agentClient
}

func (c *Client) DeploymentClient() takov1.DeploymentServiceClient {
	return c.deploymentClient
}

func (c *Client) ContainerClient() takov1.ContainerServiceClient {
	return c.containerClient
}

func (c *Client) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}
