package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/server/auth"
	"gettako.dev/tako/server/db"
	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
)

func TestServerTraefikHandlers(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "traefik_test.db")

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	defer database.Close()

	masterKey := crypto.DeriveKey("test-secret-key-32-bytes-long!")
	authHandler, _ := auth.NewHandler(database, "localhost")
	h := NewHandler(database, masterKey, "localhost")

	r := chi.NewRouter()
	r.Route("/api/auth", func(authRouter chi.Router) {
		authHandler.RegisterRoutes(authRouter)
	})
	r.Route("/api", func(apiRouter chi.Router) {
		h.RegisterRoutes(apiRouter)
	})

	// Login
	loginBody, _ := json.Marshal(auth.LoginRequest{Password: "AdminPassword123!"})
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBody))
	loginRec := httptest.NewRecorder()
	r.ServeHTTP(loginRec, loginReq)
	cookie := loginRec.Result().Cookies()[0]

	// Seed server
	_, err = database.Exec(`
		INSERT INTO servers (id, name, host, status, created_at)
		VALUES ('srv_trf_1', 'Node Traefik', '10.0.0.5', 'online', CURRENT_TIMESTAMP);
	`)
	if err != nil {
		t.Fatalf("failed to seed server: %v", err)
	}

	// 1. GET Traefik config for non-existent server -> 404
	get404Req := httptest.NewRequest(http.MethodGet, "/api/servers/srv_non_existent/traefik/config", nil)
	get404Req.AddCookie(cookie)
	get404Rec := httptest.NewRecorder()
	r.ServeHTTP(get404Rec, get404Req)
	if get404Rec.Code != http.StatusNotFound {
		t.Errorf("expected 404 for non-existent server, got %d", get404Rec.Code)
	}

	// 2. GET Traefik config for valid server (with no nodeManager -> returns empty)
	getReq := httptest.NewRequest(http.MethodGet, "/api/servers/srv_trf_1/traefik/config", nil)
	getReq.AddCookie(cookie)
	getRec := httptest.NewRecorder()
	r.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Errorf("expected 200 for valid server, got %d", getRec.Code)
	}

	// 3. PUT with invalid YAML -> 400 Bad Request
	badBody := `{"custom_yaml": "http:\n  middlewares:\n    unclosed: ["}`
	badPutReq := httptest.NewRequest(http.MethodPut, "/api/servers/srv_trf_1/traefik/config", bytes.NewReader([]byte(badBody)))
	badPutReq.AddCookie(cookie)
	badPutRec := httptest.NewRecorder()
	r.ServeHTTP(badPutRec, badPutReq)
	if badPutRec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid YAML syntax, got %d: %s", badPutRec.Code, badPutRec.Body.String())
	}

	// 4. PUT with valid YAML -> 200 OK
	validYAML := `http:
  middlewares:
    cors-headers:
      headers:
        accessControlAllowMethods:
          - GET
          - POST
`
	validBody, _ := json.Marshal(map[string]string{
		"custom_yaml": validYAML,
	})
	goodPutReq := httptest.NewRequest(http.MethodPut, "/api/servers/srv_trf_1/traefik/config", bytes.NewReader(validBody))
	goodPutReq.AddCookie(cookie)
	goodPutRec := httptest.NewRecorder()
	r.ServeHTTP(goodPutRec, goodPutReq)
	if goodPutRec.Code != http.StatusOK {
		t.Errorf("expected 200 for valid YAML, got %d: %s", goodPutRec.Code, goodPutRec.Body.String())
	}

	// 5. POST restart -> 200 OK
	restartReq := httptest.NewRequest(http.MethodPost, "/api/servers/srv_trf_1/traefik/restart", nil)
	restartReq.AddCookie(cookie)
	restartRec := httptest.NewRecorder()
	r.ServeHTTP(restartRec, restartReq)
	if restartRec.Code != http.StatusOK {
		t.Errorf("expected 200 restarting traefik, got %d: %s", restartRec.Code, restartRec.Body.String())
	}
	var actionResp models.SuccessResponse
	_ = json.Unmarshal(restartRec.Body.Bytes(), &actionResp)
	if !actionResp.Success {
		t.Errorf("expected success true in action response")
	}
}
