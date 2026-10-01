package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/pquerna/otp/totp"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/server/db"
)

func TestTOTPSecretEncryptionAndRecoveryCodeHashing(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "totp_security_test.db")

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	defer database.Close()

	masterKey := crypto.DeriveKey("totp-test-master-key-32-bytes!!")
	handler, err := NewHandler(database, "localhost", masterKey)
	if err != nil {
		t.Fatalf("failed to create auth handler: %v", err)
	}

	r := chi.NewRouter()
	r.Route("/api/auth", func(authRouter chi.Router) {
		handler.RegisterRoutes(authRouter)
	})

	// 1. Initial admin registration via first boot login
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
	if sessionCookie == nil {
		t.Fatal("session cookie missing on first boot")
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
		t.Fatal("expected non-empty totp secret in setup response")
	}
	if len(setup.RecoveryCodes) != 8 {
		t.Fatalf("expected 8 recovery codes in setup response, got %d", len(setup.RecoveryCodes))
	}

	// 3. Inspect database directly: ensure secrets are NOT stored in plaintext
	var dbSecret, dbRecoveryCodes string
	err = database.QueryRow(`SELECT two_factor_secret, recovery_codes FROM users WHERE email = 'admin@example.com'`).Scan(&dbSecret, &dbRecoveryCodes)
	if err != nil {
		t.Fatalf("failed to query user from database: %v", err)
	}

	// Plaintext TOTP secret must NOT appear in DB
	if dbSecret == setup.Secret {
		t.Fatalf("CRITICAL: two_factor_secret stored in plaintext in database!")
	}
	if strings.Contains(dbSecret, setup.Secret) {
		t.Fatalf("CRITICAL: two_factor_secret contains plaintext secret!")
	}

	// Plaintext recovery codes must NOT appear in DB
	for _, code := range setup.RecoveryCodes {
		if strings.Contains(dbRecoveryCodes, code) {
			t.Fatalf("CRITICAL: recovery code %q found in plaintext in database: %s", code, dbRecoveryCodes)
		}
	}

	// Stored recovery codes must be SHA-256 hashes (64-character hex strings)
	var storedHashes []string
	if err := json.Unmarshal([]byte(dbRecoveryCodes), &storedHashes); err != nil {
		t.Fatalf("failed to unmarshal stored recovery codes: %v", err)
	}
	if len(storedHashes) != 8 {
		t.Fatalf("expected 8 stored hashes, got %d", len(storedHashes))
	}
	for i, h := range storedHashes {
		if len(h) != 64 {
			t.Errorf("stored recovery code hash %d has invalid length %d (expected 64): %s", i, len(h), h)
		}
		expectedHash := HashRecoveryCode(setup.RecoveryCodes[i])
		if h != expectedHash {
			t.Errorf("hash %d does not match expected SHA-256 of code %s: got %s, want %s", i, setup.RecoveryCodes[i], h, expectedHash)
		}
	}

	// 4. Verify 2FA to activate it
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
		t.Fatalf("expected 200 OK verifying 2fa, got %d: %s", verifyRec.Code, verifyRec.Body.String())
	}

	// 5. Login using the first recovery code (plaintext)
	code1 := setup.RecoveryCodes[0]
	loginRec1Body, _ := json.Marshal(LoginRequest{Password: "MasterPassword123!", TwoFactorCode: &code1})
	loginRec1Req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginRec1Body))
	loginRec1Rec := httptest.NewRecorder()
	r.ServeHTTP(loginRec1Rec, loginRec1Req)

	if loginRec1Rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK logging in with recovery code 1, got %d: %s", loginRec1Rec.Code, loginRec1Rec.Body.String())
	}

	// 6. Verify that the first recovery code was consumed (removed from DB)
	err = database.QueryRow(`SELECT recovery_codes FROM users WHERE email = 'admin@example.com'`).Scan(&dbRecoveryCodes)
	if err != nil {
		t.Fatalf("failed to query updated recovery codes: %v", err)
	}
	var remainingHashes []string
	_ = json.Unmarshal([]byte(dbRecoveryCodes), &remainingHashes)
	if len(remainingHashes) != 7 {
		t.Fatalf("expected 7 remaining recovery code hashes, got %d", len(remainingHashes))
	}
	consumedHash := HashRecoveryCode(code1)
	for _, h := range remainingHashes {
		if h == consumedHash {
			t.Fatalf("consumed recovery code hash still present in DB: %s", consumedHash)
		}
	}

	// 7. Attempting to reuse code1 should fail with 401 Unauthorized
	reuseReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginRec1Body))
	reuseRec := httptest.NewRecorder()
	r.ServeHTTP(reuseRec, reuseReq)

	if reuseRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized on reusing consumed recovery code, got %d", reuseRec.Code)
	}

	// 8. Login using the second recovery code succeeds and leaves 6 codes
	code2 := setup.RecoveryCodes[1]
	loginRec2Body, _ := json.Marshal(LoginRequest{Password: "MasterPassword123!", TwoFactorCode: &code2})
	loginRec2Req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginRec2Body))
	loginRec2Rec := httptest.NewRecorder()
	r.ServeHTTP(loginRec2Rec, loginRec2Req)

	if loginRec2Rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK logging in with recovery code 2, got %d: %s", loginRec2Rec.Code, loginRec2Rec.Body.String())
	}

	_ = database.QueryRow(`SELECT recovery_codes FROM users WHERE email = 'admin@example.com'`).Scan(&dbRecoveryCodes)
	_ = json.Unmarshal([]byte(dbRecoveryCodes), &remainingHashes)
	if len(remainingHashes) != 6 {
		t.Fatalf("expected 6 remaining recovery code hashes, got %d", len(remainingHashes))
	}
}
