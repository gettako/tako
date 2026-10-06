package events_test

import (
	"testing"
	"time"

	"gettako.dev/tako/internal/events"
)

func TestEventBusPubSub(t *testing.T) {
	bus := events.NewBus()
	sub := bus.Subscribe()
	defer bus.Unsubscribe(sub)

	bus.Publish(events.Event{
		Type: events.EventNodeStatusChanged,
		Payload: map[string]string{
			"node_id": "test-node",
			"status":  "online",
		},
	})

	select {
	case ev := <-sub:
		if ev.Type != events.EventNodeStatusChanged {
			t.Errorf("expected EventNodeStatusChanged, got %s", ev.Type)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatalf("timed out waiting for event")
	}
}
