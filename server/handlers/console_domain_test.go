package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/server/auth"
	"gettako.dev/tako/server/db"
)

func TestConsoleDomainHandlers(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "console_domain_test.db")
	dynamicDir := filepath.Join(tempDir, "traefik_dynamic")
	_ = os.MkdirAll(dynamicDir, 0755)
	t.Setenv("TAKO_TRAEFIK_DYNAMIC_DIR", dynamicDir)

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
	if loginRec.Code != http.StatusOK {
		t.Fatalf("login failed: %d: %s", loginRec.Code, loginRec.Body.String())
	}
	cookie := loginRec.Result().Cookies()[0]

	// 1. GET initial domain config
	getReq := httptest.NewRequest(http.MethodGet, "/api/settings/console-domain", nil)
	getReq.AddCookie(cookie)
	getRec := httptest.NewRecorder()
	r.ServeHTTP(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on initial GET, got %d: %s", getRec.Code, getRec.Body.String())
	}

	var initCfg models.ConsoleDomainConfig
	if err := json.NewDecoder(getRec.Body).Decode(&initCfg); err != nil {
		t.Fatalf("failed to decode initial config: %v", err)
	}
	if initCfg.Domain != "localhost" {
		t.Errorf("expected domain 'localhost', got '%s'", initCfg.Domain)
	}

	// 2. POST verify DNS for localhost
	verifyBody, _ := json.Marshal(models.VerifyConsoleDomainRequest{Domain: "localhost"})
	verifyReq := httptest.NewRequest(http.MethodPost, "/api/settings/console-domain/verify", bytes.NewReader(verifyBody))
	verifyReq.AddCookie(cookie)
	verifyRec := httptest.NewRecorder()
	r.ServeHTTP(verifyRec, verifyReq)

	if verifyRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on verify DNS, got %d", verifyRec.Code)
	}
	var verifyResp models.VerifyConsoleDomainResponse
	if err := json.NewDecoder(verifyRec.Body).Decode(&verifyResp); err != nil {
		t.Fatalf("failed to decode verify response: %v", err)
	}
	if !verifyResp.Matches {
		t.Errorf("expected localhost verification to match, got false")
	}

	// 3. PUT with invalid domain -> 400 Bad Request
	badPutBody, _ := json.Marshal(models.UpdateConsoleDomainRequest{Domain: "invalid domain with spaces"})
	badPutReq := httptest.NewRequest(http.MethodPut, "/api/settings/console-domain", bytes.NewReader(badPutBody))
	badPutReq.AddCookie(cookie)
	badPutRec := httptest.NewRecorder()
	r.ServeHTTP(badPutRec, badPutReq)

	if badPutRec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 on invalid domain, got %d", badPutRec.Code)
	}

	// 4. PUT with valid domain -> 200 OK
	targetDomain := "panel.mycompany.dev"
	sslProvider := "letsencrypt"
	forceHTTPS := true
	goodPutBody, _ := json.Marshal(models.UpdateConsoleDomainRequest{
		Domain:      targetDomain,
		SSLProvider: &sslProvider,
		ForceHTTPS:  &forceHTTPS,
	})
	goodPutReq := httptest.NewRequest(http.MethodPut, "/api/settings/console-domain", bytes.NewReader(goodPutBody))
	goodPutReq.AddCookie(cookie)
	goodPutRec := httptest.NewRecorder()
	r.ServeHTTP(goodPutRec, goodPutReq)

	if goodPutRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on valid update, got %d: %s", goodPutRec.Code, goodPutRec.Body.String())
	}

	var updatedCfg models.ConsoleDomainConfig
	if err := json.NewDecoder(goodPutRec.Body).Decode(&updatedCfg); err != nil {
		t.Fatalf("failed to decode updated config: %v", err)
	}
	if updatedCfg.Domain != targetDomain {
		t.Errorf("expected updated domain '%s', got '%s'", targetDomain, updatedCfg.Domain)
	}

	// 5. Verify dynamic Traefik file was generated
	traefikFile := filepath.Join(dynamicDir, "console.yml")
	content, err := os.ReadFile(traefikFile)
	if err != nil {
		t.Fatalf("expected Traefik dynamic file %s to exist: %v", traefikFile, err)
	}
	if !strings.Contains(string(content), "Host(`panel.mycompany.dev`)") {
		t.Errorf("expected Traefik config to contain Host rule for domain, got:\n%s", string(content))
	}
	if !strings.Contains(string(content), "http://console:3000") {
		t.Errorf("expected Traefik config to route to console:3000, got:\n%s", string(content))
	}

	// 6. GET after update
	getUpdatedReq := httptest.NewRequest(http.MethodGet, "/api/settings/console-domain", nil)
	getUpdatedReq.AddCookie(cookie)
	getUpdatedRec := httptest.NewRecorder()
	r.ServeHTTP(getUpdatedRec, getUpdatedReq)

	if getUpdatedRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on GET after update, got %d", getUpdatedRec.Code)
	}
	var getUpdatedCfg models.ConsoleDomainConfig
	_ = json.NewDecoder(getUpdatedRec.Body).Decode(&getUpdatedCfg)
	if getUpdatedCfg.Domain != targetDomain {
		t.Errorf("expected GET to return updated domain '%s', got '%s'", targetDomain, getUpdatedCfg.Domain)
	}
}
