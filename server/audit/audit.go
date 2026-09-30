package audit

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type contextKey string

const ipContextKey contextKey = "audit_client_ip"

var (
	defaultMu sync.RWMutex
	defaultMgr *Manager
)

// Entry represents an immutable audit log record.
type Entry struct {
	ID           string  `json:"id"`
	Actor        string  `json:"actor"`
	Action       string  `json:"action"`
	ResourceID   *string `json:"resource_id,omitempty"`
	ResourceType *string `json:"resource_type,omitempty"`
	Metadata     *string `json:"metadata,omitempty"`
	IPAddress    *string `json:"ip_address,omitempty"`
	CreatedAt    string  `json:"created_at"`
}

// ListResponse models cursor-paginated audit log output.
type ListResponse struct {
	Items      []Entry `json:"items"`
	NextCursor *string `json:"next_cursor,omitempty"`
}

// Manager orchestrates audit persistence and retention.
type Manager struct {
	db *sql.DB
}

// NewManager initializes an audit log manager.
func NewManager(db *sql.DB) *Manager {
	return &Manager{db: db}
}

// SetDefaultManager registers the package-level audit manager.
func SetDefaultManager(m *Manager) {
	defaultMu.Lock()
	defer defaultMu.Unlock()
	defaultMgr = m
}

// GetDefaultManager returns the registered manager.
func GetDefaultManager() *Manager {
	defaultMu.RLock()
	defer defaultMu.RUnlock()
	return defaultMgr
}

// ContextWithIP stores the client IP in the request context.
func ContextWithIP(ctx context.Context, ip string) context.Context {
	return context.WithValue(ctx, ipContextKey, ip)
}

// IPFromContext retrieves the client IP from context.
func IPFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if ip, ok := ctx.Value(ipContextKey).(string); ok {
		return ip
	}
	return ""
}

const actorContextKey contextKey = "audit_actor"

// ContextWithActor stores the authenticated actor (email or username) in the context.
func ContextWithActor(ctx context.Context, actor string) context.Context {
	return context.WithValue(ctx, actorContextKey, actor)
}

// ActorFromContext retrieves the actor identity from context, defaulting to 'owner'.
func ActorFromContext(ctx context.Context) string {
	if ctx == nil {
		return "owner"
	}
	if actor, ok := ctx.Value(actorContextKey).(string); ok && strings.TrimSpace(actor) != "" {
		return strings.TrimSpace(actor)
	}
	return "owner"
}

// ClientIPMiddleware extracts the real client IP address into the request context.
func ClientIPMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractClientIP(r)
		ctx := ContextWithIP(r.Context(), ip)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func extractClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return ip
			}
		}
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		ip := strings.TrimSpace(xri)
		if ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

// Record is a non-blocking helper that executes in a fire-and-forget goroutine.
func Record(ctx context.Context, action, resourceType, resourceID string, metadata any) {
	mgr := GetDefaultManager()
	if mgr == nil {
		return
	}
	mgr.Record(ctx, action, resourceType, resourceID, metadata)
}

// Record executes audit record insertion in a detached goroutine.
func (m *Manager) Record(ctx context.Context, action, resourceType, resourceID string, metadata any) {
	if m == nil || m.db == nil {
		return
	}

	ip := IPFromContext(ctx)

	var metaStr *string
	if metadata != nil {
		switch v := metadata.(type) {
		case string:
			if strings.TrimSpace(v) != "" {
				metaStr = &v
			}
		case []byte:
			s := string(v)
			metaStr = &s
		default:
			if b, err := json.Marshal(v); err == nil {
				s := string(b)
				metaStr = &s
			}
		}
	}

	var resType *string
	if strings.TrimSpace(resourceType) != "" {
		rt := strings.TrimSpace(resourceType)
		resType = &rt
	}

	var resID *string
	if strings.TrimSpace(resourceID) != "" {
		ri := strings.TrimSpace(resourceID)
		resID = &ri
	}

	var ipAddr *string
	if strings.TrimSpace(ip) != "" {
		cleaned := strings.TrimSpace(ip)
		ipAddr = &cleaned
	}

	ulid := NewULID()
	actor := ActorFromContext(ctx)

	// Fire-and-forget goroutine with isolated timeout context to avoid response latency.
	go func(id, actUser, act string, rType, rID, meta, clientIP *string) {
		writeCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		query := `
			INSERT INTO audit_log (id, actor, action, resource_type, resource_id, metadata, ip_address, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
		`
		var lastErr error
		for attempt := 0; attempt < 5; attempt++ {
			if _, err := m.db.ExecContext(writeCtx, query, id, actUser, act, rType, rID, meta, clientIP); err != nil {
				lastErr = err
				time.Sleep(10 * time.Millisecond)
				continue
			}
			return
		}
		if lastErr != nil {
			slog.Error("failed to write audit log entry",
				slog.String("action", act),
				slog.String("id", id),
				slog.String("error", lastErr.Error()),
			)
		}
	}(ulid, actor, action, resType, resID, metaStr, ipAddr)
}

// RecordSync inserts an audit record synchronously, primarily used in testing.
func (m *Manager) RecordSync(ctx context.Context, action, resourceType, resourceID string, metadata any) (*Entry, error) {
	if m == nil || m.db == nil {
		return nil, fmt.Errorf("audit manager db is nil")
	}

	ip := IPFromContext(ctx)
	actor := ActorFromContext(ctx)

	var metaStr *string
	if metadata != nil {
		switch v := metadata.(type) {
		case string:
			if strings.TrimSpace(v) != "" {
				metaStr = &v
			}
		case []byte:
			s := string(v)
			metaStr = &s
		default:
			if b, err := json.Marshal(v); err == nil {
				s := string(b)
				metaStr = &s
			}
		}
	}

	var resType *string
	if strings.TrimSpace(resourceType) != "" {
		rt := strings.TrimSpace(resourceType)
		resType = &rt
	}

	var resID *string
	if strings.TrimSpace(resourceID) != "" {
		ri := strings.TrimSpace(resourceID)
		resID = &ri
	}

	var ipAddr *string
	if strings.TrimSpace(ip) != "" {
		cleaned := strings.TrimSpace(ip)
		ipAddr = &cleaned
	}

	ulid := NewULID()
	now := time.Now().UTC().Format(time.RFC3339)

	query := `
		INSERT INTO audit_log (id, actor, action, resource_type, resource_id, metadata, ip_address, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	if _, err := m.db.ExecContext(ctx, query, ulid, actor, action, resType, resID, metaStr, ipAddr, now); err != nil {
		return nil, fmt.Errorf("failed to insert audit record: %w", err)
	}

	return &Entry{
		ID:           ulid,
		Actor:        actor,
		Action:       action,
		ResourceID:   resID,
		ResourceType: resType,
		Metadata:     metaStr,
		IPAddress:    ipAddr,
		CreatedAt:    now,
	}, nil
}

// List retrieves audit entries ordered newest-first with cursor-based pagination.
func (m *Manager) List(ctx context.Context, limit int, before string) (*ListResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var cutoffCreatedAt, cutoffID string
	var hasCursor bool

	if strings.TrimSpace(before) != "" {
		createdAt, id, err := decodeCursor(before)
		if err == nil && createdAt != "" && id != "" {
			cutoffCreatedAt = createdAt
			cutoffID = id
			hasCursor = true
		}
	}

	var rows *sql.Rows
	var err error

	if hasCursor {
		query := `
			SELECT id, actor, action, resource_type, resource_id, metadata, ip_address, created_at
			FROM audit_log
			WHERE (created_at < ? OR (created_at = ? AND id < ?))
			ORDER BY created_at DESC, id DESC
			LIMIT ?
		`
		rows, err = m.db.QueryContext(ctx, query, cutoffCreatedAt, cutoffCreatedAt, cutoffID, limit+1)
	} else {
		query := `
			SELECT id, actor, action, resource_type, resource_id, metadata, ip_address, created_at
			FROM audit_log
			ORDER BY created_at DESC, id DESC
			LIMIT ?
		`
		rows, err = m.db.QueryContext(ctx, query, limit+1)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to query audit log: %w", err)
	}
	defer rows.Close()

	var entries []Entry
	for rows.Next() {
		var e Entry
		var resType, resID, meta, ip sql.NullString
		if err := rows.Scan(&e.ID, &e.Actor, &e.Action, &resType, &resID, &meta, &ip, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan audit entry: %w", err)
		}
		if resType.Valid {
			e.ResourceType = &resType.String
		}
		if resID.Valid {
			e.ResourceID = &resID.String
		}
		if meta.Valid {
			e.Metadata = &meta.String
		}
		if ip.Valid {
			e.IPAddress = &ip.String
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	var nextCursor *string
	if len(entries) > limit {
		lastEntry := entries[limit-1]
		cursorStr := encodeCursor(lastEntry.CreatedAt, lastEntry.ID)
		nextCursor = &cursorStr
		entries = entries[:limit]
	}

	if entries == nil {
		entries = []Entry{}
	}

	return &ListResponse{
		Items:      entries,
		NextCursor: nextCursor,
	}, nil
}

// Prune purges audit records older than the specified retention duration (e.g. 90 days).
func (m *Manager) Prune(ctx context.Context, retention time.Duration) (int64, error) {
	if retention <= 0 {
		retention = 90 * 24 * time.Hour
	}
	cutoff := time.Now().UTC().Add(-retention).Format("2006-01-02T15:04:05Z")

	res, err := m.db.ExecContext(ctx, `DELETE FROM audit_log WHERE created_at < ?`, cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to prune audit log: %w", err)
	}

	deleted, _ := res.RowsAffected()
	if deleted > 0 {
		slog.Info("pruned old audit log records",
			slog.Int64("deleted_count", deleted),
			slog.String("cutoff", cutoff),
		)
	}
	return deleted, nil
}

// StartPruner periodically cleans up audit log entries older than 90 days.
func (m *Manager) StartPruner(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 24 * time.Hour
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Initial run on startup
	_, _ = m.Prune(ctx, 90*24*time.Hour)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := m.Prune(ctx, 90*24*time.Hour); err != nil {
				slog.Error("error during audit log prune routine", slog.String("error", err.Error()))
			}
		}
	}
}

// HandleList handles GET /api/audit-log requests.
func (m *Manager) HandleList(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	before := r.URL.Query().Get("before")
	resp, err := m.List(r.Context(), limit, before)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error":   "Internal Server Error",
			"message": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(resp)
}

func encodeCursor(createdAt, id string) string {
	raw := fmt.Sprintf("%s|%s", createdAt, id)
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeCursor(cursor string) (string, string, error) {
	data, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		// Fallback to standard base64 if needed
		data, err = base64.StdEncoding.DecodeString(cursor)
		if err != nil {
			return "", "", err
		}
	}
	parts := strings.SplitN(string(data), "|", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid cursor format")
	}
	return parts[0], parts[1], nil
}
