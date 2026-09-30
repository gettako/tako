package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"gettako.dev/tako/server/audit"
	"gettako.dev/tako/server/auth"
)

func TestMultiUserCollaborationFlow(t *testing.T) {
	database, r, adminCookie := setupTestRouter(t)

	auditMgr := audit.NewManager(database)
	audit.SetDefaultManager(auditMgr)

	// 1. Initial admin check
	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	req.AddCookie(adminCookie)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK listing users as admin, got %d: %s", rec.Code, rec.Body.String())
	}

	var users []UserResponse
	if err := json.NewDecoder(rec.Body).Decode(&users); err != nil {
		t.Fatalf("failed to decode users: %v", err)
	}

	if len(users) == 0 {
		t.Fatal("expected at least one admin user")
	}
	if users[0].Role != "admin" {
		t.Fatalf("expected initial user role to be 'admin', got %s", users[0].Role)
	}
	adminUser := users[0]

	// 2. Admin creates an invitation for role 'member'
	inviteBody, _ := json.Marshal(CreateInviteRequest{Role: "member"})
	req = httptest.NewRequest(http.MethodPost, "/api/invites", bytes.NewReader(inviteBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(adminCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created creating invite, got %d: %s", rec.Code, rec.Body.String())
	}

	var createInviteResp CreateInviteResponse
	if err := json.NewDecoder(rec.Body).Decode(&createInviteResp); err != nil {
		t.Fatalf("failed to decode invite response: %v", err)
	}

	if createInviteResp.Role != "member" {
		t.Fatalf("expected invite role to be 'member', got %s", createInviteResp.Role)
	}
	if createInviteResp.Token == "" {
		t.Fatal("expected raw token in create invite response")
	}

	// 3. Admin lists invites
	req = httptest.NewRequest(http.MethodGet, "/api/invites", nil)
	req.AddCookie(adminCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK listing invites, got %d: %s", rec.Code, rec.Body.String())
	}

	var invites []InviteResponse
	_ = json.NewDecoder(rec.Body).Decode(&invites)
	if len(invites) == 0 {
		t.Fatal("expected pending invites in list")
	}

	// 4. Public token validation
	req = httptest.NewRequest(http.MethodGet, "/api/invites/validate?token="+createInviteResp.Token, nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK validating token, got %d: %s", rec.Code, rec.Body.String())
	}

	var valResp InviteValidationResponse
	_ = json.NewDecoder(rec.Body).Decode(&valResp)
	if !valResp.Valid || valResp.Role != "member" {
		t.Fatalf("expected valid token with role member, got %+v", valResp)
	}

	// 5. Public registration with invitation token
	acceptBody, _ := json.Marshal(AcceptInviteRequest{
		Token:    createInviteResp.Token,
		Name:     "Collab Dev",
		Email:    "collab@gettako.dev",
		Password: "SecurePassword123!",
	})
	req = httptest.NewRequest(http.MethodPost, "/api/invites/accept", bytes.NewReader(acceptBody))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK accepting invite, got %d: %s", rec.Code, rec.Body.String())
	}

	var memberCookie *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == auth.SessionCookieName {
			memberCookie = c
			break
		}
	}
	if memberCookie == nil {
		t.Fatal("expected session cookie to be set upon invite acceptance")
	}

	var loginResp auth.LoginResponse
	_ = json.NewDecoder(rec.Body).Decode(&loginResp)
	if loginResp.User.Role != "member" {
		t.Fatalf("expected registered user role to be 'member', got %s", loginResp.User.Role)
	}
	memberID := loginResp.User.ID

	// Token cannot be reused
	req = httptest.NewRequest(http.MethodGet, "/api/invites/validate?token="+createInviteResp.Token, nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for consumed token, got %d", rec.Code)
	}

	// 6. Member attempts to access admin routes (expect 403 Forbidden)
	req = httptest.NewRequest(http.MethodGet, "/api/users", nil)
	req.AddCookie(memberCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for member accessing /api/users, got %d", rec.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/api/servers", bytes.NewReader([]byte(`{"name":"illegal-node"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(memberCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for member creating server, got %d", rec.Code)
	}

	// Member can access standard authorized routes like listing projects
	req = httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	req.AddCookie(memberCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for member accessing /api/projects, got %d", rec.Code)
	}

	// 7. Admin updates member role to admin
	patchBody, _ := json.Marshal(UpdateUserRoleRequest{Role: "admin"})
	req = httptest.NewRequest(http.MethodPatch, "/api/users/"+memberID+"/role", bytes.NewReader(patchBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(adminCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK promoting member to admin, got %d: %s", rec.Code, rec.Body.String())
	}

	// Promoted user can now access admin endpoints
	req = httptest.NewRequest(http.MethodGet, "/api/users", nil)
	req.AddCookie(memberCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for promoted user accessing /api/users, got %d", rec.Code)
	}

	// Demoting self is forbidden
	req = httptest.NewRequest(http.MethodPatch, "/api/users/"+adminUser.ID+"/role", bytes.NewReader([]byte(`{"role":"member"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(adminCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when admin attempts to demote self, got %d", rec.Code)
	}

	// Demote memberID back to member
	patchBody, _ = json.Marshal(UpdateUserRoleRequest{Role: "member"})
	req = httptest.NewRequest(http.MethodPatch, "/api/users/"+memberID+"/role", bytes.NewReader(patchBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(adminCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK demoting back to member, got %d: %s", rec.Code, rec.Body.String())
	}

	// 8. Delete user and verify immediate session invalidation
	req = httptest.NewRequest(http.MethodDelete, "/api/users/"+memberID, nil)
	req.AddCookie(adminCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK deleting user, got %d: %s", rec.Code, rec.Body.String())
	}

	// Deleted user's session should now be rejected with 401 Unauthorized
	req = httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	req.AddCookie(memberCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized using invalidated session of deleted user, got %d", rec.Code)
	}

	// Admin cannot delete self
	req = httptest.NewRequest(http.MethodDelete, "/api/users/"+adminUser.ID, nil)
	req.AddCookie(adminCookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when admin attempts to delete self, got %d", rec.Code)
	}

	// 9. Verify dynamic audit attribution
	time.Sleep(50 * time.Millisecond) // wait for goroutines to commit
	var actorCount int
	err := database.QueryRow("SELECT count(*) FROM audit_log WHERE actor = 'collab@gettako.dev'").Scan(&actorCount)
	if err != nil {
		t.Fatalf("failed to query audit log: %v", err)
	}
	if actorCount == 0 {
		t.Fatal("expected audit log entries to attribute to 'collab@gettako.dev'")
	}
}
