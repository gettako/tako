package events

import (
	"sync"
)

type EventType string

const (
	EventNodeStatusChanged EventType = "node.status_changed"
	EventNodeMetrics       EventType = "node.metrics"
	EventDeploymentLog     EventType = "deployment.log"
	EventAuditCreated      EventType = "audit.created"
)

type Event struct {
	Type    EventType `json:"type"`
	Payload any       `json:"payload"`
}

type Subscriber chan Event

type Bus struct {
	mu          sync.RWMutex
	subscribers map[Subscriber]struct{}
}

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
