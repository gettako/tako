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

	// Case 7b: Passkey Login Validation (Fix wrong passkey cannot login)
	badPkLoginBody, _ := json.Marshal(PasskeyLoginRequest{CredentialID: "invalid-credential-id"})
	reqBadPkLogin := httptest.NewRequest(http.MethodPost, "/api/v1/auth/passkey/login", bytes.NewReader(badPkLoginBody))
	reqBadPkLogin.Header.Set("Content-Type", "application/json")
	wBadPkLogin := httptest.NewRecorder()
	router.ServeHTTP(wBadPkLogin, reqBadPkLogin)
	if wBadPkLogin.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong passkey login with no passkeys, got %d", wBadPkLogin.Code)
	}

	emptyPkLoginBody, _ := json.Marshal(PasskeyLoginRequest{CredentialID: ""})
	reqEmptyPkLogin := httptest.NewRequest(http.MethodPost, "/api/v1/auth/passkey/login", bytes.NewReader(emptyPkLoginBody))
	reqEmptyPkLogin.Header.Set("Content-Type", "application/json")
	wEmptyPkLogin := httptest.NewRecorder()
	router.ServeHTTP(wEmptyPkLogin, reqEmptyPkLogin)
	if wEmptyPkLogin.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty passkey login, got %d", wEmptyPkLogin.Code)
	}

	// Register passkey with specific CredentialID
	goodPkBody, _ := json.Marshal(map[string]string{
		"name":         "YubiKey Hardware",
		"credentialId": "cred-yubikey-12345",
	})
	reqGoodPk := httptest.NewRequest(http.MethodPost, "/api/v1/auth/passkeys", bytes.NewReader(goodPkBody))
	wGoodPk := httptest.NewRecorder()
	router.ServeHTTP(wGoodPk, reqGoodPk)
	if wGoodPk.Code != http.StatusCreated {
		t.Fatalf("expected 201 for add passkey with credential ID, got %d", wGoodPk.Code)
	}

	// Attempt wrong passkey when passkeys exist in DB -> MUST BE 401
	wBadPkLogin2 := httptest.NewRecorder()
	reqBadPkLogin2 := httptest.NewRequest(http.MethodPost, "/api/v1/auth/passkey/login", bytes.NewReader(badPkLoginBody))
	reqBadPkLogin2.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(wBadPkLogin2, reqBadPkLogin2)
	if wBadPkLogin2.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for wrong passkey when passkeys exist, got %d", wBadPkLogin2.Code)
	}

	// Attempt valid passkey -> 200 OK
	validPkLoginBody, _ := json.Marshal(PasskeyLoginRequest{CredentialID: "cred-yubikey-12345"})
	reqValidPkLogin := httptest.NewRequest(http.MethodPost, "/api/v1/auth/passkey/login", bytes.NewReader(validPkLoginBody))
	reqValidPkLogin.Header.Set("Content-Type", "application/json")
	wValidPkLogin := httptest.NewRecorder()
	router.ServeHTTP(wValidPkLogin, reqValidPkLogin)
	if wValidPkLogin.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid passkey login, got %d", wValidPkLogin.Code)
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

func TestUserManagementAndPermissions(t *testing.T) {
	db, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	if err := store.SeedDefaultAdmin(context.Background(), db, "admin@gettako.dev", "secret123"); err != nil {
		t.Fatalf("SeedDefaultAdmin failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(db, bus, "test-secret")
	router := NewRouter(db, orch)

	// 1. Test GET /api/v1/auth/users
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/users", nil)
	listW := httptest.NewRecorder()
	router.ServeHTTP(listW, listReq)
	if listW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for list users, got %d", listW.Code)
	}

	var users []AuthUserResponse
	if err := json.Unmarshal(listW.Body.Bytes(), &users); err != nil {
		t.Fatalf("failed to parse users json: %v", err)
	}
	if len(users) != 1 {
		t.Fatalf("expected 1 user, got %d", len(users))
	}
	// Verify user avatar generation
	if users[0].AvatarURL == "" {
		t.Errorf("expected non-empty AvatarURL for user")
	}

	// 2. Test POST /api/v1/auth/users (create new user)
	createBody, _ := json.Marshal(map[string]string{
		"name":  "Budi Santoso",
		"email": "budi@gettako.dev",
		"role":  "member",
	})
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/users", bytes.NewReader(createBody))
	createReq.Header.Set("Content-Type", "application/json")
	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, createReq)
	if createW.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for user creation, got %d: %s", createW.Code, createW.Body.String())
	}

	var createdUser AuthUserResponse
	if err := json.Unmarshal(createW.Body.Bytes(), &createdUser); err != nil {
		t.Fatalf("failed to decode created user: %v", err)
	}
	if createdUser.Role != "member" || createdUser.Email != "budi@gettako.dev" {
		t.Errorf("unexpected created user: %+v", createdUser)
	}

	// 3. Test PUT /api/v1/auth/users/{id}/role (update user role)
	updateRoleBody, _ := json.Marshal(map[string]string{
		"role": "admin",
	})
	updateReq := httptest.NewRequest(http.MethodPut, "/api/v1/auth/users/"+createdUser.ID+"/role", bytes.NewReader(updateRoleBody))
	updateReq.Header.Set("Content-Type", "application/json")
	updateW := httptest.NewRecorder()
	router.ServeHTTP(updateW, updateReq)
	if updateW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for update role, got %d: %s", updateW.Code, updateW.Body.String())
	}

	// 4. Test DELETE /api/v1/auth/users/{id}
	delReq := httptest.NewRequest(http.MethodDelete, "/api/v1/auth/users/"+createdUser.ID, nil)
	delW := httptest.NewRecorder()
	router.ServeHTTP(delW, delReq)
	if delW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for delete user, got %d: %s", delW.Code, delW.Body.String())
	}

	// 5. Test idempotent DELETE on non-existent or already deleted user
	delReq2 := httptest.NewRequest(http.MethodDelete, "/api/v1/auth/users/non-existent-user-123", nil)
	delW2 := httptest.NewRecorder()
	router.ServeHTTP(delW2, delReq2)
	if delW2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for idempotent delete on non-existent user, got %d: %s", delW2.Code, delW2.Body.String())
	}
}


