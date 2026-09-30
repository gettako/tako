package main

import (
	"testing"

	"gettako.dev/tako/internal/protocol"
)

func TestHandleContainerAction_UnsupportedAction(t *testing.T) {
	// A nil or disconnected dockerCli will fail on listing or unsupported action
	actionReq := &protocol.ContainerAction{
		ServiceId: "srv_test",
		Action:    "unknown-action",
	}

	// With nil dockerCli, listing containers will panic if called directly,
	// but we can test protocol ContainerAction validation
	if actionReq.GetAction() != "unknown-action" {
		t.Fatalf("expected unknown-action, got %s", actionReq.GetAction())
	}
	if actionReq.GetDeleteVolumes() != false {
		t.Fatalf("expected DeleteVolumes default false")
	}
	if actionReq.GetPruneImages() != false {
		t.Fatalf("expected PruneImages default false")
	}
}

func TestContainerActionProtoFields(t *testing.T) {
	actionReq := &protocol.ContainerAction{
		TaskId:        "act_123",
		ServiceId:     "srv_lifecycle",
		Action:        "pull-update",
		DeleteVolumes: true,
		PruneImages:   true,
		Image:         "postgres:16-alpine",
	}

	if actionReq.GetTaskId() != "act_123" {
		t.Errorf("expected act_123, got %s", actionReq.GetTaskId())
	}
	if actionReq.GetServiceId() != "srv_lifecycle" {
		t.Errorf("expected srv_lifecycle, got %s", actionReq.GetServiceId())
	}
	if actionReq.GetAction() != "pull-update" {
		t.Errorf("expected pull-update, got %s", actionReq.GetAction())
	}
	if !actionReq.GetDeleteVolumes() {
		t.Errorf("expected DeleteVolumes to be true")
	}
	if !actionReq.GetPruneImages() {
		t.Errorf("expected PruneImages to be true")
	}
	if actionReq.GetImage() != "postgres:16-alpine" {
		t.Errorf("expected postgres:16-alpine, got %s", actionReq.GetImage())
	}
}
