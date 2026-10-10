package orchestrator

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"gettako.dev/tako/internal/events"
)

var (
	scaleCooldownsMu sync.Mutex
	scaleCooldowns   = make(map[string]time.Time)
)

// StartAutoScaler periodically inspects services with auto-scaling enabled and scales replicas up or down based on configured criteria.
func (o *Orchestrator) StartAutoScaler(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 15 * time.Second
	}

	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				o.evaluateAutoScaling(ctx)
			}
		}
	}()
}

func (o *Orchestrator) evaluateAutoScaling(ctx context.Context) {
	rows, err := o.db.QueryContext(ctx, `
		SELECT id, name, slug, replicas, auto_scaling_enabled, min_replicas, max_replicas,
		       target_cpu_percent, auto_scaling_metric, target_memory_percent, scale_down_cpu_percent,
		       cooldown_seconds, memory_limit_mb
		FROM services
		WHERE auto_scaling_enabled = 1 AND status IN ('live', 'healthy')
	`)
	if err != nil {
		return
	}
	defer rows.Close()

	type scalingCandidate struct {
		id                  string
		name                string
		slug                string
		replicas            int64
		minReplicas         int64
		maxReplicas         int64
		targetCPUPercent    float64
		metric              string
		targetMemoryPercent float64
		scaleDownCPUPercent float64
		cooldownSeconds     int64
		memoryLimitMB       int64
	}

	var candidates []scalingCandidate
	for rows.Next() {
		var c scalingCandidate
		var enabled int64
		if err := rows.Scan(
			&c.id, &c.name, &c.slug, &c.replicas, &enabled, &c.minReplicas, &c.maxReplicas,
			&c.targetCPUPercent, &c.metric, &c.targetMemoryPercent, &c.scaleDownCPUPercent,
			&c.cooldownSeconds, &c.memoryLimitMB,
		); err == nil {
			if enabled == 1 {
				if c.minReplicas <= 0 {
					c.minReplicas = 1
				}
				if c.maxReplicas < c.minReplicas {
					c.maxReplicas = c.minReplicas
				}
				if c.targetCPUPercent <= 0 {
					c.targetCPUPercent = 80.0
				}
				if c.metric == "" {
					c.metric = "cpu"
				}
				if c.targetMemoryPercent <= 0 {
					c.targetMemoryPercent = 80.0
				}
				if c.scaleDownCPUPercent <= 0 {
					c.scaleDownCPUPercent = 25.0
				}
				if c.cooldownSeconds <= 0 {
					c.cooldownSeconds = 60
				}
				candidates = append(candidates, c)
			}
		}
	}

	now := time.Now()

	for _, c := range candidates {
		// Enforce cooldown stabilization window
		scaleCooldownsMu.Lock()
		lastScaled, hasScaled := scaleCooldowns[c.id]
		scaleCooldownsMu.Unlock()

		cooldownDuration := time.Duration(c.cooldownSeconds) * time.Second
		if hasScaled && now.Sub(lastScaled) < cooldownDuration {
			continue
		}

		pt, hasData := o.GetLatestServiceTelemetry(c.id, c.slug)
		if !hasData {
			continue
		}

		// Calculate RAM consumption percentage
		memPercent := 0.0
		limitMB := pt.MemoryLimitMB
		if limitMB <= 0 {
			limitMB = c.memoryLimitMB
		}
		if limitMB > 0 && pt.MemoryUsedMB > 0 {
			memPercent = (float64(pt.MemoryUsedMB) / float64(limitMB)) * 100.0
		}

		// Determine scale-up and scale-down conditions based on custom metric criteria
		shouldScaleUp := false
		shouldScaleDown := false
		var reason string

		switch c.metric {
		case "memory":
			if memPercent > c.targetMemoryPercent {
				shouldScaleUp = true
				reason = fmt.Sprintf("RAM %.1f%% > Target %.1f%%", memPercent, c.targetMemoryPercent)
			} else if memPercent < (c.targetMemoryPercent * 0.4) {
				shouldScaleDown = true
				reason = fmt.Sprintf("RAM %.1f%% < Low Threshold %.1f%%", memPercent, c.targetMemoryPercent*0.4)
			}
		case "both":
			if pt.CPUPercent > c.targetCPUPercent || memPercent > c.targetMemoryPercent {
				shouldScaleUp = true
				reason = fmt.Sprintf("CPU %.1f%% > %.1f%% OR RAM %.1f%% > %.1f%%", pt.CPUPercent, c.targetCPUPercent, memPercent, c.targetMemoryPercent)
			} else if pt.CPUPercent < c.scaleDownCPUPercent && (memPercent == 0 || memPercent < (c.targetMemoryPercent*0.4)) {
				shouldScaleDown = true
				reason = fmt.Sprintf("CPU %.1f%% < %.1f%% AND RAM %.1f%% < %.1f%%", pt.CPUPercent, c.scaleDownCPUPercent, memPercent, c.targetMemoryPercent*0.4)
			}
		case "cpu":
			fallthrough
		default:
			if pt.CPUPercent > c.targetCPUPercent {
				shouldScaleUp = true
				reason = fmt.Sprintf("CPU %.1f%% > Target %.1f%%", pt.CPUPercent, c.targetCPUPercent)
			} else if pt.CPUPercent < c.scaleDownCPUPercent {
				shouldScaleDown = true
				reason = fmt.Sprintf("CPU %.1f%% < Low Threshold %.1f%%", pt.CPUPercent, c.scaleDownCPUPercent)
			}
		}

		// Execute Scale Up
		if shouldScaleUp && c.replicas < c.maxReplicas {
			newReplicas := c.replicas + 1
			_, err := o.db.ExecContext(ctx, "UPDATE services SET replicas = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", newReplicas, c.id)
			if err == nil {
				scaleCooldownsMu.Lock()
				scaleCooldowns[c.id] = time.Now()
				scaleCooldownsMu.Unlock()

				log.Printf("[autoscaler] scale UP service %s (%s): replicas %d -> %d (%s, cooldown: %ds)",
					c.name, c.id, c.replicas, newReplicas, reason, c.cooldownSeconds)
				_, _ = o.RecordAudit(ctx, AuditLogInput{
					Action:     "autoscaled_up",
					TargetType: "service",
					TargetID:   c.id,
					TargetName: c.name,
					Metadata: map[string]any{
						"oldReplicas":         c.replicas,
						"newReplicas":         newReplicas,
						"cpuPercent":          pt.CPUPercent,
						"memoryPercent":       memPercent,
						"metric":              c.metric,
						"targetCpuPercent":    c.targetCPUPercent,
						"targetMemoryPercent": c.targetMemoryPercent,
						"reason":              reason,
					},
				})
				o.bus.Publish(events.Event{
					Type: events.EventServiceUpdated,
					Payload: map[string]any{
						"service_id":   c.id,
						"replicas":     newReplicas,
						"scaled_event": "up",
						"reason":       reason,
					},
				})
			}
		} else if shouldScaleDown && c.replicas > c.minReplicas {
			// Execute Scale Down
			newReplicas := c.replicas - 1
			_, err := o.db.ExecContext(ctx, "UPDATE services SET replicas = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", newReplicas, c.id)
			if err == nil {
				scaleCooldownsMu.Lock()
				scaleCooldowns[c.id] = time.Now()
				scaleCooldownsMu.Unlock()

				log.Printf("[autoscaler] scale DOWN service %s (%s): replicas %d -> %d (%s, cooldown: %ds)",
					c.name, c.id, c.replicas, newReplicas, reason, c.cooldownSeconds)
				_, _ = o.RecordAudit(ctx, AuditLogInput{
					Action:     "autoscaled_down",
					TargetType: "service",
					TargetID:   c.id,
					TargetName: c.name,
					Metadata: map[string]any{
						"oldReplicas":         c.replicas,
						"newReplicas":         newReplicas,
						"cpuPercent":          pt.CPUPercent,
						"memoryPercent":       memPercent,
						"metric":              c.metric,
						"scaleDownCpuPercent": c.scaleDownCPUPercent,
						"reason":              reason,
					},
				})
				o.bus.Publish(events.Event{
					Type: events.EventServiceUpdated,
					Payload: map[string]any{
						"service_id":   c.id,
						"replicas":     newReplicas,
						"scaled_event": "down",
						"reason":       reason,
					},
				})
			}
		}
	}
}
