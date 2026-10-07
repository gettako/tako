package docker

import (
	"context"
	"testing"
)

func TestResolveContainerNilClient(t *testing.T) {
	c := &Client{cli: nil}
	ctx := context.Background()

	name := "tako-app-tako-demo-hello"
	resolved := c.ResolveContainer(ctx, name)
	if resolved != name {
		t.Fatalf("expected %s, got %s", name, resolved)
	}

	all := c.ResolveAllContainers(ctx, name)
	if len(all) != 1 || all[0] != name {
		t.Fatalf("expected [%s], got %v", name, all)
	}
}
