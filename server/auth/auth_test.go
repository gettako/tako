package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/pquerna/otp/totp"

	"gettako.dev/tako/server/db"
)

func setupTestAuth(t *testing.T) (*Handler, chi.Router) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "auth_test.db")

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	handler, err := NewHandler(database, "localhost")
	if err != nil {
		t.Fatalf("failed to create auth handler: %v", err)
	}

	r := chi.NewRouter()
	r.Route("/api/auth", func(authRouter chi.Router) {
		handler.RegisterRoutes(authRouter)
	})

	return handler, r
}

func TestFirstBootAndLoginFlow(t *testing.T) {
	_, r := setupTestAuth(t)

	// 1. First boot: creating admin user with login
	body, _ := json.Marshal(LoginRequest{Password: "AdminPassword123!"})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on first boot, got %d: %s", rec.Code, rec.Body.String())
	}

	cookies := rec.Result().Cookies()
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == SessionCookieName {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("expected session cookie to be set on first boot")
	}

	// 2. Wrong password returns 401 Unauthorized
	wrongBody, _ := json.Marshal(LoginRequest{Password: "WrongPassword!"})
	req2 := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(wrongBody))
	req2.Header.Set("Content-Type", "application/json")
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized on wrong password, got %d", rec2.Code)
	}

	// 3. Login with correct password sets session cookie
	req3 := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req3.Header.Set("Content-Type", "application/json")
	rec3 := httptest.NewRecorder()
	r.ServeHTTP(rec3, req3)

	if rec3.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on correct password, got %d", rec3.Code)
	}
}

func TestMiddlewareProtectionAndMe(t *testing.T) {
	_, r := setupTestAuth(t)

	// 1. Unauthenticated request to /api/auth/me should fail with 401
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for unauthenticated me, got %d", rec.Code)
	}

	// 2. First boot login to get cookie
	loginBody, _ := json.Marshal(LoginRequest{Password: "AdminPassword123!"})
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBody))
	loginRec := httptest.NewRecorder()
	r.ServeHTTP(loginRec, loginReq)

	var sessionCookie *http.Cookie
	for _, c := range loginRec.Result().Cookies() {
		if c.Name == SessionCookieName {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("session cookie missing")
	}

	// 3. Authenticated request to /api/auth/me succeeds
	meReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meReq.AddCookie(sessionCookie)
	meRec := httptest.NewRecorder()
	r.ServeHTTP(meRec, meReq)

	if meRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for authenticated me, got %d: %s", meRec.Code, meRec.Body.String())
	}

	var user User
	if err := json.Unmarshal(meRec.Body.Bytes(), &user); err != nil {
		t.Fatalf("failed to decode user json: %v", err)
	}
	if user.Email != "admin@gettako.dev" {
		t.Errorf("expected email 'admin@gettako.dev', got %s", user.Email)
	}

	// 4. Logout terminates session
	logoutReq := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	logoutReq.AddCookie(sessionCookie)
	logoutRec := httptest.NewRecorder()
	r.ServeHTTP(logoutRec, logoutReq)

	if logoutRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for logout, got %d", logoutRec.Code)
	}

	// 5. Subsequent request with invalidated session fails
	meReqAfterLogout := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meReqAfterLogout.AddCookie(sessionCookie)
	meRecAfterLogout := httptest.NewRecorder()
	r.ServeHTTP(meRecAfterLogout, meReqAfterLogout)

	if meRecAfterLogout.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized after logout, got %d", meRecAfterLogout.Code)
	}
}

func TestTwoFactorAuthenticationFlow(t *testing.T) {
	_, r := setupTestAuth(t)

	// 1. Initial admin creation
	loginBody, _ := json.Marshal(LoginRequest{Password: "MasterPassword123!"})
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBody))
	loginRec := httptest.NewRecorder()
	r.ServeHTTP(loginRec, loginReq)

	var sessionCookie *http.Cookie
	for _, c := range loginRec.Result().Cookies() {
		if c.Name == SessionCookieName {
			sessionCookie = c
			break
		}
	}

	// 2. Setup 2FA
	setupReq := httptest.NewRequest(http.MethodPost, "/api/auth/2fa/setup", nil)
	setupReq.AddCookie(sessionCookie)
	setupRec := httptest.NewRecorder()
	r.ServeHTTP(setupRec, setupReq)

	if setupRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for 2fa setup, got %d: %s", setupRec.Code, setupRec.Body.String())
	}

	var setup TwoFactorSetup
	if err := json.Unmarshal(setupRec.Body.Bytes(), &setup); err != nil {
		t.Fatalf("failed to decode setup json: %v", err)
	}
	if setup.Secret == "" {
		t.Fatal("expected non-empty totp secret")
	}

	// 3. Verify and activate 2FA
	passcode, err := totp.GenerateCode(setup.Secret, time.Now())
	if err != nil {
		t.Fatalf("failed to generate totp code: %v", err)
	}

	verifyBody, _ := json.Marshal(TwoFactorVerifyRequest{Code: passcode})
	verifyReq := httptest.NewRequest(http.MethodPost, "/api/auth/2fa/verify", bytes.NewReader(verifyBody))
	verifyReq.AddCookie(sessionCookie)
	verifyRec := httptest.NewRecorder()
	r.ServeHTTP(verifyRec, verifyReq)

	if verifyRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for 2fa verify, got %d: %s", verifyRec.Code, verifyRec.Body.String())
	}

	// 4. Try logging in without 2FA code: should return requires_2fa: true and NO session cookie
	loginNo2FAReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBody))
	loginNo2FARec := httptest.NewRecorder()
	r.ServeHTTP(loginNo2FARec, loginNo2FAReq)

	if loginNo2FARec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on login check, got %d", loginNo2FARec.Code)
	}

	var loginResp LoginResponse
	_ = json.Unmarshal(loginNo2FARec.Body.Bytes(), &loginResp)
	if !loginResp.Requires2FA {
		t.Fatal("expected requires_2fa to be true")
	}
	for _, c := range loginNo2FARec.Result().Cookies() {
		if c.Name == SessionCookieName && c.Value != "" {
			t.Fatal("did not expect session cookie when 2FA is required and not supplied")
		}
	}

	// 5. Login with invalid 2FA code should return 401
	badCode := "000000"
	loginBadCodeBody, _ := json.Marshal(LoginRequest{Password: "MasterPassword123!", TwoFactorCode: &badCode})
	loginBadReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBadCodeBody))
	loginBadRec := httptest.NewRecorder()
	r.ServeHTTP(loginBadRec, loginBadReq)

	if loginBadRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 on bad 2fa code, got %d", loginBadRec.Code)
	}

	// 6. Login with recovery code should succeed
	recCode := setup.RecoveryCodes[0]
	loginRecBody, _ := json.Marshal(LoginRequest{Password: "MasterPassword123!", TwoFactorCode: &recCode})
	loginRecReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginRecBody))
	loginRecRec := httptest.NewRecorder()
	r.ServeHTTP(loginRecRec, loginRecReq)

	if loginRecRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on recovery code login, got %d: %s", loginRecRec.Code, loginRecRec.Body.String())
	}
}
