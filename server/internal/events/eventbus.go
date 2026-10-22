// Package events provides an in-memory pub-sub event bus used to distribute
// real-time cluster state updates to Server-Sent Event (SSE) HTTP streams.
package events

import (
	"sync"
)

// EventType enumerates supported cluster event categories.
type EventType string

const (
	EventNodeStatusChanged EventType = "node.status_changed"
	EventNodeMetrics       EventType = "node.metrics"
	EventDeploymentLog     EventType = "deployment.log"
	EventAuditCreated      EventType = "audit.created"
	EventServiceUpdated    EventType = "service.updated"
)

// Event represents an event payload dispatched across the bus.
type Event struct {
	Type    EventType `json:"type"`
	Payload any       `json:"payload"`
}

// Subscriber is an event channel receiving published events.
type Subscriber chan Event

// Bus manages registered subscribers with thread-safe fanout publishing.
type Bus struct {
	mu          sync.RWMutex
	subscribers map[Subscriber]struct{}
}

// NewBus initializes an empty in-memory event bus.
func NewBus() *Bus {
	return &Bus{
		subscribers: make(map[Subscriber]struct{}),
	}
}

// Subscribe creates a new buffered channel subscription.
func (b *Bus) Subscribe() Subscriber {
	b.mu.Lock()
	defer b.mu.Unlock()

	ch := make(Subscriber, 64)
	b.subscribers[ch] = struct{}{}
	return ch
}

// Unsubscribe removes and closes the subscriber channel.
func (b *Bus) Unsubscribe(sub Subscriber) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if _, ok := b.subscribers[sub]; ok {
		delete(b.subscribers, sub)
		close(sub)
	}
}

// Publish broadcasts an event to all subscribers non-blockingly.
func (b *Bus) Publish(event Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for sub := range b.subscribers {
		select {
		case sub <- event:
		default:
			// Non-blocking drop if consumer buffer is full
		}
	}
}
