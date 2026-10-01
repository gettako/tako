package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/net/websocket"

	"gettako.dev/tako/internal/protocol"
	"gettako.dev/tako/server/audit"
	"gettako.dev/tako/server/auth"
)

type terminalResizePayload struct {
	Type string `json:"type"`
	Cols int32  `json:"cols"`
	Rows int32  `json:"rows"`
}

func (h *Handler) HandleServiceTerminal(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		sendError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		sendError(w, http.StatusBadRequest, "Service ID is required")
		return
	}

	var serverID string
	err := h.db.QueryRowContext(r.Context(), `SELECT server_id FROM services WHERE id = ?`, id).Scan(&serverID)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error: "+err.Error())
		return
	}

	if h.nodeManager == nil {
		sendError(w, http.StatusServiceUnavailable, "Node manager unavailable")
		return
	}

	server := websocket.Server{
		Handshake: func(cfg *websocket.Config, req *http.Request) error {
			origin := req.Header.Get("Origin")
			if origin == "" {
				return errors.New("missing origin header")
			}
			u, err := url.Parse(origin)
			if err != nil {
				return errors.New("invalid origin header")
			}
			originHost := u.Hostname()
			allowed := false
			if strings.EqualFold(originHost, h.domain) || originHost == "localhost" || originHost == "127.0.0.1" {
				allowed = true
			}
			if !allowed {
				return fmt.Errorf("forbidden origin: %s", u.Host)
			}
			return nil
		},
		Handler: func(ws *websocket.Conn) {
			defer ws.Close()

			randBytes := make([]byte, 8)
			_, _ = rand.Read(randBytes)
			sessionID := fmt.Sprintf("term_%d_%s", time.Now().UnixNano(), hex.EncodeToString(randBytes))

			audit.Record(r.Context(), "service.terminal_start", "service", id, map[string]any{
				"session_id": sessionID,
				"server_id":  serverID,
				"user_id":    user.ID,
			})

			closeCh := make(chan struct{})
			var closeOnce sync.Once
			safeClose := func() {
				closeOnce.Do(func() {
					close(closeCh)
				})
			}

			h.nodeManager.RegisterTerminalSession(sessionID, func(data []byte) {
				_, _ = ws.Write(data)
			}, func(reason string) {
				safeClose()
			})

			defer func() {
				audit.Record(r.Context(), "service.terminal_end", "service", id, map[string]any{
					"session_id": sessionID,
				})
				h.nodeManager.UnregisterTerminalSession(sessionID)
				_ = h.nodeManager.SendTerminalClose(serverID, sessionID, "client disconnected")
			}()

			shell := r.URL.Query().Get("shell")
			if shell == "" {
				shell = "/bin/sh"
			}

			err := h.nodeManager.SendTerminalStart(serverID, &protocol.TerminalStart{
				SessionId: sessionID,
				ServiceId: id,
				Shell:     shell,
				Cols:      80,
				Rows:      24,
			})
			if err != nil {
				_, _ = ws.Write([]byte(fmt.Sprintf("\r\nFailed to start terminal on agent: %v\r\n", err)))
				return
			}

			go func() {
				defer safeClose()
				buf := make([]byte, 4096)
				for {
					n, err := ws.Read(buf)
					if err != nil {
						return
					}
					if n > 0 {
						chunk := buf[:n]
						if len(chunk) > 10 && chunk[0] == '{' {
							var resizeMsg terminalResizePayload
							if jsonErr := json.Unmarshal(chunk, &resizeMsg); jsonErr == nil && resizeMsg.Type == "resize" {
								_ = h.nodeManager.SendTerminalResize(serverID, sessionID, resizeMsg.Cols, resizeMsg.Rows)
								continue
							}
						}
						_ = h.nodeManager.SendTerminalData(serverID, sessionID, chunk)
					}
				}
			}()

			<-closeCh
		},
	}

	server.ServeHTTP(w, r)
}
