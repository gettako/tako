package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
	"gettako.dev/tako/internal/store/db"
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

	// Case 2b: Unauthenticated request to protected endpoint MUST return 401
	unauthReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	unauthW := httptest.NewRecorder()
	router.ServeHTTP(unauthW, unauthReq)
	if unauthW.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for unauthenticated /auth/me, got %d", unauthW.Code)
	}

	// Case 3: GET /api/v1/auth/me
	req3 := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req3.Header.Set("Authorization", "Bearer "+resp.Token)
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
	reqProf.Header.Set("Authorization", "Bearer "+resp.Token)
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
	reqBadPwd.Header.Set("Authorization", "Bearer "+resp.Token)
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
	reqGoodPwd.Header.Set("Authorization", "Bearer "+resp.Token)
	wGoodPwd := httptest.NewRecorder()
	router.ServeHTTP(wGoodPwd, reqGoodPwd)
	if wGoodPwd.Code != http.StatusOK {
		t.Fatalf("expected 200 for good password change, got %d", wGoodPwd.Code)
	}

	// Case 7: Passkeys
	pkBody, _ := json.Marshal(map[string]string{"name": "MacBook Touch ID"})
	reqPk := httptest.NewRequest(http.MethodPost, "/api/v1/auth/passkeys", bytes.NewReader(pkBody))
	reqPk.Header.Set("Authorization", "Bearer "+resp.Token)
	wPk := httptest.NewRecorder()
	router.ServeHTTP(wPk, reqPk)
	if wPk.Code != http.StatusCreated {
		t.Fatalf("expected 201 for add passkey, got %d", wPk.Code)
	}

	var createdPk PasskeyItem
	_ = json.Unmarshal(wPk.Body.Bytes(), &createdPk)

	reqGetPk := httptest.NewRequest(http.MethodGet, "/api/v1/auth/passkeys", nil)
	reqGetPk.Header.Set("Authorization", "Bearer "+resp.Token)
	wGetPk := httptest.NewRecorder()
	router.ServeHTTP(wGetPk, reqGetPk)
	var passkeys []PasskeyItem
	_ = json.Unmarshal(wGetPk.Body.Bytes(), &passkeys)
	if len(passkeys) != 1 || passkeys[0].Name != "MacBook Touch ID" {
		t.Errorf("unexpected passkeys: %+v", passkeys)
	}

	reqDelPk := httptest.NewRequest(http.MethodDelete, "/api/v1/auth/passkeys/"+createdPk.ID, nil)
	reqDelPk.Header.Set("Authorization", "Bearer "+resp.Token)
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
	reqGoodPk.Header.Set("Authorization", "Bearer "+resp.Token)
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
	req2FA.Header.Set("Authorization", "Bearer "+resp.Token)
	w2FA := httptest.NewRecorder()
	router.ServeHTTP(w2FA, req2FA)
	if w2FA.Code != http.StatusOK {
		t.Fatalf("expected 200 for update 2FA, got %d", w2FA.Code)
	}

	// Case 9: Sessions
	reqSess := httptest.NewRequest(http.MethodGet, "/api/v1/auth/sessions", nil)
	reqSess.Header.Set("Authorization", "Bearer "+resp.Token)
	wSess := httptest.NewRecorder()
	router.ServeHTTP(wSess, reqSess)
	if wSess.Code != http.StatusOK {
		t.Fatalf("expected 200 for get sessions, got %d", wSess.Code)
	}

	// Case 10: Logout revokes session and clears cookie
	reqLogout := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	reqLogout.Header.Set("Authorization", "Bearer "+resp.Token)
	wLogout := httptest.NewRecorder()
	router.ServeHTTP(wLogout, reqLogout)
	if wLogout.Code != http.StatusOK {
		t.Fatalf("expected 200 for logout, got %d", wLogout.Code)
	}

	// Verify cookie was cleared
	setCookieHeader := wLogout.Header().Get("Set-Cookie")
	if !strings.Contains(setCookieHeader, sessionCookieName) {
		t.Fatalf("expected Set-Cookie to clear %s, got: %s", sessionCookieName, setCookieHeader)
	}

	// Session token should no longer be valid for protected endpoints
	reqAfterLogout := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	reqAfterLogout.Header.Set("Authorization", "Bearer "+resp.Token)
	wAfterLogout := httptest.NewRecorder()
	router.ServeHTTP(wAfterLogout, reqAfterLogout)
	if wAfterLogout.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for /auth/me after logout, got %d", wAfterLogout.Code)
	}

	// Calling logout again when unauthenticated should still return 200 OK
	reqLogoutAgain := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	wLogoutAgain := httptest.NewRecorder()
	router.ServeHTTP(wLogoutAgain, reqLogoutAgain)
	if wLogoutAgain.Code != http.StatusOK {
		t.Fatalf("expected 200 for unauthenticated logout, got %d", wLogoutAgain.Code)
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
	router := newTestRouter(t, db, orch)

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

func TestAuthRateLimit(t *testing.T) {
	db, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	if err := store.SeedDefaultAdmin(context.Background(), db, "target@gettako.dev", "correct-pwd"); err != nil {
		t.Fatalf("SeedDefaultAdmin failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(db, bus, "test-secret")
	router := NewRouter(db, orch)

	loginPayload, _ := json.Marshal(LoginRequest{
		Email:    "target@gettako.dev",
		Password: "wrong-password",
	})

	// Trigger 10 failed login attempts
	for i := 0; i < 10; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(loginPayload))
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "192.168.10.55:12345"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: expected 401 Unauthorized, got %d", i+1, w.Code)
		}
	}

	// 11th attempt should trigger 429 Too Many Requests
	blockedReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(loginPayload))
	blockedReq.Header.Set("Content-Type", "application/json")
	blockedReq.RemoteAddr = "192.168.10.55:12345"
	blockedW := httptest.NewRecorder()
	router.ServeHTTP(blockedW, blockedReq)

	if blockedW.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 Too Many Requests, got %d: %s", blockedW.Code, blockedW.Body.String())
	}

	// Another IP should not be blocked
	otherIPReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(loginPayload))
	otherIPReq.Header.Set("Content-Type", "application/json")
	otherIPReq.RemoteAddr = "192.168.10.56:12345"
	otherIPW := httptest.NewRecorder()
	router.ServeHTTP(otherIPW, otherIPReq)

	if otherIPW.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized for distinct IP, got %d", otherIPW.Code)
	}

	// Reset for test cleanup
	globalLoginTracker.reset("192.168.10.55:target@gettako.dev")
	globalLoginTracker.reset("192.168.10.56:target@gettako.dev")
}


func TestAcceptInviteStrictValidation(t *testing.T) {
	db, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(db, bus, "test-secret")
	router := NewRouter(db, orch)

	// 1. Accept invite when no user_invites setting exists -> 400 Bad Request
	body1, _ := json.Marshal(AcceptInvitePayload{
		Token:    "random-token-123",
		Email:    "newuser@gettako.dev",
		Name:     "New User",
		Password: "password123456",
	})
	req1 := httptest.NewRequest(http.MethodPost, "/api/v1/auth/invite/accept", bytes.NewReader(body1))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing invites setting, got %d", w1.Code)
	}

	// 2. Set user_invites with a valid invite
	invites := []map[string]any{
		{
			"token":     "valid-invite-token-abc",
			"email":     "invited@gettako.dev",
			"role":      "member",
			"expiresAt": "2099-01-01T00:00:00Z",
		},
	}
	invBytes, _ := json.Marshal(invites)
	_, _ = db.Exec("INSERT INTO cluster_settings (key, value) VALUES (?, ?)", "user_invites", string(invBytes))

	// 3. Attempt with wrong token -> 400
	bodyWrongTok, _ := json.Marshal(AcceptInvitePayload{
		Token:    "wrong-token",
		Email:    "invited@gettako.dev",
		Name:     "Invited User",
		Password: "password123456",
	})
	reqWrongTok := httptest.NewRequest(http.MethodPost, "/api/v1/auth/invite/accept", bytes.NewReader(bodyWrongTok))
	reqWrongTok.Header.Set("Content-Type", "application/json")
	wWrongTok := httptest.NewRecorder()
	router.ServeHTTP(wWrongTok, reqWrongTok)
	if wWrongTok.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for wrong token, got %d", wWrongTok.Code)
	}

	// 4. Attempt with valid token but mismatched email -> 400
	bodyWrongEmail, _ := json.Marshal(AcceptInvitePayload{
		Token:    "valid-invite-token-abc",
		Email:    "attacker@gettako.dev",
		Name:     "Attacker",
		Password: "password123456",
	})
	reqWrongEmail := httptest.NewRequest(http.MethodPost, "/api/v1/auth/invite/accept", bytes.NewReader(bodyWrongEmail))
	reqWrongEmail.Header.Set("Content-Type", "application/json")
	wWrongEmail := httptest.NewRecorder()
	router.ServeHTTP(wWrongEmail, reqWrongEmail)
	if wWrongEmail.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for mismatched email, got %d", wWrongEmail.Code)
	}

	// 5. Attempt with valid token and email, client specifies role admin -> role must remain member from invite record
	bodyGood, _ := json.Marshal(AcceptInvitePayload{
		Token:    "valid-invite-token-abc",
		Email:    "invited@gettako.dev",
		Name:     "Valid Member",
		Password: "password123456",
		Role:     "admin", // client tries to elevate to admin
	})
	reqGood := httptest.NewRequest(http.MethodPost, "/api/v1/auth/invite/accept", bytes.NewReader(bodyGood))
	reqGood.Header.Set("Content-Type", "application/json")
	wGood := httptest.NewRecorder()
	router.ServeHTTP(wGood, reqGood)
	if wGood.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid invite acceptance, got %d: %s", wGood.Code, wGood.Body.String())
	}

	var resp LoginResponse
	_ = json.Unmarshal(wGood.Body.Bytes(), &resp)
	if resp.User.Role != "member" {
		t.Errorf("expected member role enforced from invite record, got %s", resp.User.Role)
	}

	// 6. Token should now be consumed (redeemed) -> second attempt fails with 400
	wReused := httptest.NewRecorder()
	reqReused := httptest.NewRequest(http.MethodPost, "/api/v1/auth/invite/accept", bytes.NewReader(bodyGood))
	reqReused.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(wReused, reqReused)
	if wReused.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for already redeemed invite token, got %d", wReused.Code)
	}
}

func TestProfileUpdateScopedToAuthenticatedUser(t *testing.T) {
	sqlDB, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer sqlDB.Close()

	if err := store.Migrate(sqlDB); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	// Seed admin
	if err := store.SeedDefaultAdmin(context.Background(), sqlDB, "admin@gettako.dev", "secret123"); err != nil {
		t.Fatalf("SeedDefaultAdmin failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(sqlDB, bus, "test-secret")
	router := NewRouter(sqlDB, orch)

	// Create member user
	memberUser, err := orch.Queries().CreateUser(context.Background(), db.CreateUserParams{
		ID:           "usr-member-456",
		Name:         "Original Member",
		Email:        "member@gettako.dev",
		PasswordHash: "hashed",
		Role:         "member",
	})
	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	// Register session for member user
	memberToken := "token-member-456"
	orch.RegisterUserSession(memberToken, memberUser)

	// Member updates profile
	updateBody, _ := json.Marshal(UpdateProfileRequest{
		Name:  "Updated Member Name",
		Email: "newmemberemail@gettako.dev",
	})
	req := httptest.NewRequest(http.MethodPut, "/api/v1/auth/profile", bytes.NewReader(updateBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+memberToken)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for member profile update, got %d: %s", w.Code, w.Body.String())
	}

	// Verify member was updated
	updatedMember, err := orch.Queries().GetUserByID(context.Background(), memberUser.ID)
	if err != nil || updatedMember.Name != "Updated Member Name" {
		t.Errorf("expected member name to be updated, got: %+v", updatedMember)
	}

	// Verify admin was NOT touched
	adminUser, err := orch.Queries().GetUserByEmail(context.Background(), "admin@gettako.dev")
	if err != nil || adminUser.Name == "Updated Member Name" {
		t.Errorf("admin user should not have been updated! got: %+v", adminUser)
	}
}
