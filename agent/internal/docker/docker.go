package docker

import (
	"context"
	"fmt"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/system"
	"github.com/docker/docker/client"
)

type Client struct {
	cli *client.Client
}

// New creates a Docker engine client connected via environment or local socket.
func New() (*Client, error) {
	cli, err := client.NewClientWithOpts(
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %w", err)
	}

	return &Client{cli: cli}, nil
}

// Ping checks if Docker daemon is responsive.
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.cli.Ping(ctx)
	return err
}

// Version returns the Docker engine version string.
func (c *Client) Version(ctx context.Context) (string, error) {
	v, err := c.cli.ServerVersion(ctx)
	if err != nil {
		return "unknown", err
	}
	return v.Version, nil
}

// Info returns system information from the Docker daemon.
func (c *Client) Info(ctx context.Context) (system.Info, error) {
	return c.cli.Info(ctx)
}

// ListContainers returns all active and stopped containers.
func (c *Client) ListContainers(ctx context.Context, all bool) ([]types.Container, error) {
	return c.cli.ContainerList(ctx, container.ListOptions{All: all})
}

// Events returns a channel of container-related Docker events and an error channel.
func (c *Client) Events(ctx context.Context) (<-chan events.Message, <-chan error) {
	eventFilter := filters.NewArgs()
	eventFilter.Add("type", "container")

	return c.cli.Events(ctx, types.EventsOptions{
		Filters: eventFilter,
	})
}

// RawClient returns the underlying *client.Client for advanced operations.
func (c *Client) RawClient() *client.Client {
	return c.cli
}

// Close closes the Docker client connection.
func (c *Client) Close() error {
	if c.cli != nil {
		return c.cli.Close()
	}
	return nil
}
