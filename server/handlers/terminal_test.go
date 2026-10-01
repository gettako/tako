package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/net/websocket"

	"gettako.dev/tako/server/auth"
	"gettako.dev/tako/server/db"
	"gettako.dev/tako/server/nodes"
	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/protocol"
)

func TestHandleServiceTerminal_Unauthenticated(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "term_test.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	defer database.Close()

	masterKey := crypto.DeriveKey("test-secret-key-32-bytes-long!")
	h := NewHandler(database, masterKey, "localhost")

	r := chi.NewRouter()
	r.Get("/api/services/{id}/terminal", h.HandleServiceTerminal)

	req := httptest.NewRequest(http.MethodGet, "/api/services/svc_123/terminal", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestHandleServiceTerminal_NotFound(t *testing.T) {
	_, r, cookie := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/services/non_existent_id/terminal", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestHandleServiceTerminal_WebSocketSession(t *testing.T) {
	database, _, sessionCookie, _, serviceID := setupDeployTestRouter(t)

	serverID := "srv_worker_1"
	mockStream := &mockStreamServer{}

	nodeManager := nodes.NewNodeManager(database)
	_, _ = nodeManager.RegisterSession(context.Background(), serverID, mockStream)

	masterKey := crypto.DeriveKey("test-secret-key-32-bytes-long!")
	h := NewHandler(database, masterKey, "localhost")
	h.SetNodeManager(nodeManager)

	mux := chi.NewRouter()
	mux.Use(auth.RequireAuth(database))
	mux.Get("/api/services/{id}/terminal", h.HandleServiceTerminal)

	server := httptest.NewServer(mux)
	defer server.Close()

	wsURL := "ws" + server.URL[4:] + "/api/services/" + serviceID + "/terminal"
	cfg, err := websocket.NewConfig(wsURL, server.URL)
	if err != nil {
		t.Fatalf("failed to create ws config: %v", err)
	}
	cfg.Header.Add("Cookie", sessionCookie.String())

	ws, err := websocket.DialConfig(cfg)
	if err != nil {
		t.Fatalf("failed to dial websocket: %v", err)
	}
	defer ws.Close()

	time.Sleep(50 * time.Millisecond)

	sentMsgs := mockStream.getSent()
	if len(sentMsgs) == 0 {
		t.Fatalf("expected TerminalStart sent to agent, got 0 messages")
	}

	startMsg := sentMsgs[0].GetTerminalStart()
	if startMsg == nil {
		t.Fatalf("expected TerminalStart message, got %+v", sentMsgs[0])
	}
	sessionID := startMsg.GetSessionId()

	// Simulate agent sending terminal data back
	nodeManager.HandleTerminalData(&protocol.TerminalData{
		SessionId: sessionID,
		Data:      []byte("hello terminal\n"),
	})

	buf := make([]byte, 1024)
	n, err := ws.Read(buf)
	if err != nil {
		t.Fatalf("failed to read from websocket: %v", err)
	}
	if string(buf[:n]) != "hello terminal\n" {
		t.Errorf("expected 'hello terminal\\n', got %q", string(buf[:n]))
	}

	// Client sends command
	_, err = ws.Write([]byte("ls\n"))
	if err != nil {
		t.Fatalf("failed to write to websocket: %v", err)
	}

	time.Sleep(50 * time.Millisecond)

	var foundInput bool
	for _, msg := range mockStream.getSent() {
		if td := msg.GetTerminalData(); td != nil && td.GetSessionId() == sessionID {
			if string(td.GetData()) == "ls\n" {
				foundInput = true
			}
		}
	}
	if !foundInput {
		t.Errorf("expected TerminalData 'ls\\n' sent to node, got %d messages", len(mockStream.getSent()))
	}

	_ = sql.ErrNoRows
}

func TestHandleServiceTerminal_OriginValidation(t *testing.T) {
	database, _, sessionCookie, _, serviceID := setupDeployTestRouter(t)

	serverID := "srv_worker_1"
	mockStream := &mockStreamServer{}

	nodeManager := nodes.NewNodeManager(database)
	_, _ = nodeManager.RegisterSession(context.Background(), serverID, mockStream)

	masterKey := crypto.DeriveKey("test-secret-key-32-bytes-long!")
	h := NewHandler(database, masterKey, "gettako.dev")
	h.SetNodeManager(nodeManager)

	mux := chi.NewRouter()
	mux.Use(auth.RequireAuth(database))
	mux.Get("/api/services/{id}/terminal", h.HandleServiceTerminal)

	server := httptest.NewServer(mux)
	defer server.Close()

	wsURL := "ws" + server.URL[4:] + "/api/services/" + serviceID + "/terminal"

	// 1. Untrusted third-party origin should be rejected
	cfgMalicious, err := websocket.NewConfig(wsURL, "https://malicious.com")
	if err != nil {
		t.Fatalf("failed to create ws config: %v", err)
	}
	cfgMalicious.Header.Add("Cookie", sessionCookie.String())

	_, err = websocket.DialConfig(cfgMalicious)
	if err == nil {
		t.Fatal("expected handshake to fail for untrusted origin https://malicious.com")
	}

	// 2. Untrusted preview subdomain should be rejected when domain is gettako.dev
	cfgPreview, err := websocket.NewConfig(wsURL, "https://pr-42.gettako.dev")
	if err != nil {
		t.Fatalf("failed to create ws config: %v", err)
	}
	cfgPreview.Header.Add("Cookie", sessionCookie.String())

	_, err = websocket.DialConfig(cfgPreview)
	if err == nil {
		t.Fatal("expected handshake to fail for subdomain https://pr-42.gettako.dev")
	}

	// 3. Trusted origin (gettako.dev) should succeed
	cfgAllowed, err := websocket.NewConfig(wsURL, "https://gettako.dev")
	if err != nil {
		t.Fatalf("failed to create ws config: %v", err)
	}
	cfgAllowed.Header.Add("Cookie", sessionCookie.String())

	ws, err := websocket.DialConfig(cfgAllowed)
	if err != nil {
		t.Fatalf("expected handshake to succeed for configured domain https://gettako.dev, got: %v", err)
	}
	ws.Close()
}

