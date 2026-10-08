package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
)

func TestAuthLogin(t *testing.T) {
	db, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	// Seed admin user
	if err := store.SeedDefaultAdmin(context.Background(), db, "admin@gettako.dev", "secret123"); err != nil {
		t.Fatalf("SeedDefaultAdmin failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(db, bus, "test-secret")
	router := NewRouter(db, orch)

	// Case 1: Wrong password
	invalidBody, _ := json.Marshal(LoginRequest{
		Email:    "admin@gettako.dev",
		Password: "wrongpassword",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(invalidBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized, got %d: %s", w.Code, w.Body.String())
	}

	// Case 2: Correct password
	validBody, _ := json.Marshal(LoginRequest{
		Email:    "admin@gettako.dev",
		Password: "secret123",
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(validBody))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w2.Code, w2.Body.String())
	}

	var resp LoginResponse
	if err := json.Unmarshal(w2.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.User.Email != "admin@gettako.dev" {
		t.Errorf("expected user email admin@gettako.dev, got %s", resp.User.Email)
	}
	if resp.Token == "" {
		t.Errorf("expected non-empty token")
	}

	// Case 3: GET /api/v1/auth/me
	req3 := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	w3 := httptest.NewRecorder()
	router.ServeHTTP(w3, req3)

	if w3.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /auth/me, got %d", w3.Code)
	}

	// Case 4: PUT /api/v1/auth/profile
	profBody, _ := json.Marshal(UpdateProfileRequest{
		Name:      "Alex Lead",
		Email:     "alex@gettako.dev",
		AvatarURL: "https://example.com/avatar.png",
	})
	reqProf := httptest.NewRequest(http.MethodPut, "/api/v1/auth/profile", bytes.NewReader(profBody))
	reqProf.Header.Set("Content-Type", "application/json")
	wProf := httptest.NewRecorder()
	router.ServeHTTP(wProf, reqProf)

	if wProf.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for update profile, got %d: %s", wProf.Code, wProf.Body.String())
	}

	var updatedUser AuthUserResponse
	if err := json.Unmarshal(wProf.Body.Bytes(), &updatedUser); err != nil {
		t.Fatalf("failed to decode updated user: %v", err)
	}
	if updatedUser.Name != "Alex Lead" || updatedUser.Email != "alex@gettako.dev" {
		t.Errorf("unexpected updated user: %+v", updatedUser)
	}

	// Case 5: PUT /api/v1/auth/password (wrong current password)
	badPwdBody, _ := json.Marshal(ChangePasswordRequest{
		CurrentPassword: "wrongpassword",
		NewPassword:     "newsecret123456",
	})
	reqBadPwd := httptest.NewRequest(http.MethodPut, "/api/v1/auth/password", bytes.NewReader(badPwdBody))
	reqBadPwd.Header.Set("Content-Type", "application/json")
	wBadPwd := httptest.NewRecorder()
	router.ServeHTTP(wBadPwd, reqBadPwd)
	if wBadPwd.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for wrong current password, got %d", wBadPwd.Code)
	}

	// Case 6: PUT /api/v1/auth/password (valid current password)
	goodPwdBody, _ := json.Marshal(ChangePasswordRequest{
		CurrentPassword: "secret123",
		NewPassword:     "newsecret123456",
	})
	reqGoodPwd := httptest.NewRequest(http.MethodPut, "/api/v1/auth/password", bytes.NewReader(goodPwdBody))
	reqGoodPwd.Header.Set("Content-Type", "application/json")
	wGoodPwd := httptest.NewRecorder()
	router.ServeHTTP(wGoodPwd, reqGoodPwd)
	if wGoodPwd.Code != http.StatusOK {
		t.Fatalf("expected 200 for good password change, got %d", wGoodPwd.Code)
	}

	// Case 7: Passkeys
	pkBody, _ := json.Marshal(map[string]string{"name": "MacBook Touch ID"})
	reqPk := httptest.NewRequest(http.MethodPost, "/api/v1/auth/passkeys", bytes.NewReader(pkBody))
	wPk := httptest.NewRecorder()
	router.ServeHTTP(wPk, reqPk)
	if wPk.Code != http.StatusCreated {
		t.Fatalf("expected 201 for add passkey, got %d", wPk.Code)
	}

	var createdPk PasskeyItem
	_ = json.Unmarshal(wPk.Body.Bytes(), &createdPk)

	reqGetPk := httptest.NewRequest(http.MethodGet, "/api/v1/auth/passkeys", nil)
	wGetPk := httptest.NewRecorder()
	router.ServeHTTP(wGetPk, reqGetPk)
	var passkeys []PasskeyItem
	_ = json.Unmarshal(wGetPk.Body.Bytes(), &passkeys)
	if len(passkeys) != 1 || passkeys[0].Name != "MacBook Touch ID" {
		t.Errorf("unexpected passkeys: %+v", passkeys)
	}

	reqDelPk := httptest.NewRequest(http.MethodDelete, "/api/v1/auth/passkeys/"+createdPk.ID, nil)
	wDelPk := httptest.NewRecorder()
	router.ServeHTTP(wDelPk, reqDelPk)
	if wDelPk.Code != http.StatusOK {
		t.Fatalf("expected 200 for delete passkey, got %d", wDelPk.Code)
	}

	// Case 8: 2FA status
	twoFABody, _ := json.Marshal(TwoFASetting{
		Enabled:       true,
		Secret:        "TESTSECRET",
		RecoveryCodes: []string{"abc-123"},
	})
	req2FA := httptest.NewRequest(http.MethodPut, "/api/v1/auth/2fa", bytes.NewReader(twoFABody))
	w2FA := httptest.NewRecorder()
	router.ServeHTTP(w2FA, req2FA)
	if w2FA.Code != http.StatusOK {
		t.Fatalf("expected 200 for update 2FA, got %d", w2FA.Code)
	}

	// Case 9: Sessions
	reqSess := httptest.NewRequest(http.MethodGet, "/api/v1/auth/sessions", nil)
	wSess := httptest.NewRecorder()
	router.ServeHTTP(wSess, reqSess)
	if wSess.Code != http.StatusOK {
		t.Fatalf("expected 200 for get sessions, got %d", wSess.Code)
	}
}

