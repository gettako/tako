package main

import (
	"context"
	"fmt"
	"time"

	"github.com/docker/docker/client"
)

func initDockerClient(dockerHost string) (*client.Client, error) {
	opts := []client.Opt{
		client.FromEnv,
		client.WithAPIVersionNegotiation(),
	}
	if dockerHost != "" {
		opts = append(opts, client.WithHost(dockerHost))
	}

	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if _, err := cli.Ping(ctx); err != nil {
		cli.Close()
		return nil, fmt.Errorf("docker daemon unreachable or socket inaccessible: %w", err)
	}

	return cli, nil
}
