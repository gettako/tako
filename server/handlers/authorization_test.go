package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/server/audit"
	"gettako.dev/tako/server/auth"
)

func TestMemberForbiddenOnAdminRoutes(t *testing.T) {
	database, r, adminCookie := setupTestRouter(t)

	auditMgr := audit.NewManager(database)
	audit.SetDefaultManager(auditMgr)

	// Create an invitation for a member
	inviteBody, _ := json.Marshal(CreateInviteRequest{Role: "member"})
	req := httptest.NewRequest(http.MethodPost, "/api/invites", bytes.NewReader(inviteBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(adminCookie)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created creating invite, got %d: %s", rec.Code, rec.Body.String())
	}

	var createInviteResp CreateInviteResponse
	if err := json.NewDecoder(rec.Body).Decode(&createInviteResp); err != nil {
		t.Fatalf("failed to decode invite response: %v", err)
	}

	// Accept invite to obtain member session cookie
	acceptBody, _ := json.Marshal(AcceptInviteRequest{
		Token:    createInviteResp.Token,
		Name:     "Test Member",
		Email:    "member@gettako.dev",
		Password: "MemberPassword123!",
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
		t.Fatal("expected session cookie for member")
	}

	routesToTest := []struct {
		method string
		path   string
		body   string
	}{
		// Console Domain
		{"GET", "/api/settings/console-domain", ""},
		{"PUT", "/api/settings/console-domain", `{"domain":"example.com"}`},
		{"POST", "/api/settings/console-domain/verify", ""},

		// S3 Backup Configuration & Control Plane Records
		{"GET", "/api/settings/backup", ""},
		{"PUT", "/api/settings/backup", `{"enabled":false}`},
		{"POST", "/api/settings/backup/test", `{}`},
		{"GET", "/api/settings/backup/records", ""},
		{"POST", "/api/settings/backup/trigger", ""},
		{"GET", "/api/settings/backup/records/rec_123/download", ""},
		{"DELETE", "/api/settings/backup/records/rec_123", ""},

		// Notification Channels
		{"GET", "/api/settings/notifications", ""},
		{"POST", "/api/settings/notifications", `{"name":"test","type":"discord","config":{}}`},
		{"PATCH", "/api/settings/notifications/notif_123", `{"name":"test2"}`},
		{"DELETE", "/api/settings/notifications/notif_123", ""},
		{"POST", "/api/settings/notifications/notif_123/test", ""},

		// S3 Storage Destinations
		{"GET", "/api/storage/s3", ""},
		{"POST", "/api/storage/s3", `{"name":"s3","bucket":"test","endpoint":"http://s3.local","access_key":"k","secret_key":"s","region":"us-east-1"}`},
		{"PATCH", "/api/storage/s3/s3_123", `{"name":"s3-updated"}`},
		{"DELETE", "/api/storage/s3/s3_123", ""},
		{"POST", "/api/storage/s3/s3_123/test", ""},
		{"POST", "/api/storage/s3/test", `{"bucket":"test","endpoint":"http://s3.local","access_key":"k","secret_key":"s","region":"us-east-1"}`},

		// GitHub Connection Mutations
		{"POST", "/api/github/manifest/exchange", `{"code":"test"}`},
		{"POST", "/api/github/sync-installations", ""},
		{"POST", "/api/github/connections", `{"name":"test","auth_type":"pat","token":"ghp_test"}`},
		{"DELETE", "/api/github/connections/conn_123", ""},
	}

	for _, rt := range routesToTest {
		t.Run(rt.method+" "+rt.path, func(t *testing.T) {
			var bodyReader *bytes.Reader
			if rt.body != "" {
				bodyReader = bytes.NewReader([]byte(rt.body))
			} else {
				bodyReader = bytes.NewReader(nil)
			}
			req := httptest.NewRequest(rt.method, rt.path, bodyReader)
			if rt.body != "" {
				req.Header.Set("Content-Type", "application/json")
			}
			req.AddCookie(memberCookie)
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)

			if rec.Code != http.StatusForbidden {
				t.Errorf("expected 403 Forbidden for member on %s %s, got %d: %s",
					rt.method, rt.path, rec.Code, rec.Body.String())
			}
		})
	}
}
