package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
)

func registerEventsRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/events", func(r chi.Router) {
		// GET /api/v1/events/nodes
		r.Get("/nodes", func(w http.ResponseWriter, r *http.Request) {
			flusher, ok := w.(http.Flusher)
			if !ok {
				http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")
			w.Header().Set("X-Accel-Buffering", "no")

			// Send initial snapshot
			nodes, err := orch.Queries().ListNodes(r.Context())
			if err == nil {
				items := make([]NodeResponse, 0, len(nodes))
				for _, n := range nodes {
					items = append(items, mapNodeToResponse(n))
				}
				if snapshotData, err := json.Marshal(items); err == nil {
					_, _ = fmt.Fprintf(w, "event: snapshot\ndata: %s\n\n", snapshotData)
					flusher.Flush()
				}
			}

			sub := orch.Bus().Subscribe()
			defer orch.Bus().Unsubscribe(sub)

			ctx := r.Context()
			for {
				select {
				case <-ctx.Done():
					return
				case ev, ok := <-sub:
					if !ok {
						return
					}
					// Only forward node events
					if ev.Type == events.EventNodeStatusChanged || ev.Type == events.EventNodeMetrics {
						data, err := json.Marshal(ev.Payload)
						if err == nil {
							_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Type, data)
							flusher.Flush()
						}
					}
				}
			}
		})
	})
}
