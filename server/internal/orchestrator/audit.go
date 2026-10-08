package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/store/db"
)

const ClientIPContextKey = "tako_client_ip"

type AuditLogInput struct {
	ActorID    string
	ActorName  string
	ActorEmail string
	Action     string
	TargetType string
	TargetID   string
	TargetName string
	Metadata   map[string]interface{}
	IPAddress  string
}

// RecordAudit logs an administrative event to the audit_logs table and emits it onto the event bus.
func (o *Orchestrator) RecordAudit(ctx context.Context, input AuditLogInput) (*db.AuditLog, error) {
	if input.ActorID == "" {
		input.ActorID = "usr_admin"
		input.ActorName = "Administrator"
		input.ActorEmail = "admin@gettako.dev"
	}

	if input.IPAddress == "" {
		if ip, ok := ctx.Value(ClientIPContextKey).(string); ok && ip != "" {
			input.IPAddress = ip
		} else if ip, ok := ctx.Value("client_ip").(string); ok && ip != "" {
			input.IPAddress = ip
		}
	}
	if input.IPAddress == "" {
		input.IPAddress = "127.0.0.1"
	}

	metadataStr := "{}"
	if input.Metadata != nil {
		if b, err := json.Marshal(input.Metadata); err == nil {
			metadataStr = string(b)
		}
	}

	id := fmt.Sprintf("aud_%d", time.Now().UnixNano())

	entry, err := o.queries.CreateAuditLog(ctx, db.CreateAuditLogParams{
		ID:         id,
		ActorID:    input.ActorID,
		ActorName:  input.ActorName,
		ActorEmail: input.ActorEmail,
		Action:     input.Action,
		TargetType: input.TargetType,
		TargetID:   input.TargetID,
		TargetName: input.TargetName,
		Metadata:   metadataStr,
		IpAddress:  input.IPAddress,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create audit log: %w", err)
	}

	if o.bus != nil {
		o.bus.Publish(events.Event{
			Type:    events.EventAuditCreated,
			Payload: entry,
		})
	}

	return &entry, nil
}
