package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/server/auth"
	"gettako.dev/tako/server/db"
	"gettako.dev/tako/server/dns"
	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
)

type staticResolver struct {
	ip net.IP
}

func (s *staticResolver) LookupIPAddr(ctx context.Context, host string) ([]net.IPAddr, error) {
	return []net.IPAddr{{IP: s.ip}}, nil
}

func TestCheckDomainSSLDNSMismatchAndMatch(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "dns_check_test.db")

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

	// Seed server with host 203.0.113.10
	_, err = database.Exec(`
		INSERT INTO servers (id, name, host, status, created_at)
		VALUES ('srv_node1', 'Worker 1', '203.0.113.10', 'online', CURRENT_TIMESTAMP);
		INSERT INTO projects (id, name, created_at)
		VALUES ('prj_1', 'Test Project', CURRENT_TIMESTAMP);
		INSERT INTO services (id, project_id, server_id, name, repository, branch, dockerfile_path, status, created_at)
		VALUES ('svc_1', 'prj_1', 'srv_node1', 'Web App', 'org/repo', 'main', 'Dockerfile', 'healthy', CURRENT_TIMESTAMP);
		INSERT INTO domains (id, service_id, domain, port, ssl_status, created_at)
		VALUES ('dom_1', 'svc_1', 'app.mycompany.com', 3000, 'pending', CURRENT_TIMESTAMP);
	`)
	if err != nil {
		t.Fatalf("failed to seed test data: %v", err)
	}

	// 1. Configure DNS resolver pointing to a different IP (DNS mismatch)
	mismatchResolver := &staticResolver{ip: net.ParseIP("198.51.100.99")}
	h.SetDNSChecker(dns.NewDNSChecker(mismatchResolver))

	req := httptest.NewRequest(http.MethodPost, "/api/services/svc_1/domains/dom_1/check-ssl", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var d models.Domain
	if err := json.Unmarshal(rec.Body.Bytes(), &d); err != nil {
		t.Fatalf("failed to unmarshal domain: %v", err)
	}

	if d.SSLStatus != "error" {
		t.Errorf("expected ssl_status 'error' on DNS mismatch, got %s", d.SSLStatus)
	}
	if d.SSLError == nil || !strings.Contains(*d.SSLError, "DNS mismatch") {
		t.Errorf("expected DNS mismatch error message, got %+v", d.SSLError)
	}
	if d.SSLError != nil && strings.Contains(*d.SSLError, "—") {
		t.Errorf("error contains forbidden em dash: %s", *d.SSLError)
	}

	// Verify DB was updated
	var dbStatus string
	var dbErr string
	_ = database.QueryRow(`SELECT ssl_status, ssl_error FROM domains WHERE id = 'dom_1'`).Scan(&dbStatus, &dbErr)
	if dbStatus != "error" || !strings.Contains(dbErr, "DNS mismatch") {
		t.Errorf("db not updated with error state: status=%s, err=%s", dbStatus, dbErr)
	}

	// 2. Configure DNS resolver pointing to target server IP (DNS match)
	matchingResolver := &staticResolver{ip: net.ParseIP("203.0.113.10")}
	h.SetDNSChecker(dns.NewDNSChecker(matchingResolver))

	req = httptest.NewRequest(http.MethodPost, "/api/services/svc_1/domains/dom_1/check-ssl", nil)
	req.AddCookie(cookie)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200 on matching DNS, got %d", rec.Code)
	}

	_ = json.Unmarshal(rec.Body.Bytes(), &d)
	if d.SSLStatus != "pending" && d.SSLStatus != "active" {
		t.Errorf("expected status 'pending' or 'active' after DNS resolved, got %s", d.SSLStatus)
	}
	if d.SSLError != nil {
		t.Errorf("expected cleared ssl error after DNS resolved, got %s", *d.SSLError)
	}
}

func TestAdvancedIngressHandlers(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "ingress_test.db")

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

	// Seed server and services
	_, err = database.Exec(`
		INSERT INTO servers (id, name, host, status, created_at)
		VALUES ('srv_node1', 'Worker 1', '127.0.0.1', 'online', CURRENT_TIMESTAMP);
		INSERT INTO projects (id, name, created_at)
		VALUES ('prj_1', 'Test Project', CURRENT_TIMESTAMP);
		INSERT INTO services (id, project_id, server_id, name, repository, branch, dockerfile_path, status, created_at)
		VALUES ('svc_main', 'prj_1', 'srv_node1', 'Web Frontend', 'org/repo', 'main', 'Dockerfile', 'healthy', CURRENT_TIMESTAMP);
		INSERT INTO services (id, project_id, server_id, name, repository, branch, dockerfile_path, status, created_at)
		VALUES ('svc_api', 'prj_1', 'srv_node1', 'Backend API', 'org/api', 'main', 'Dockerfile', 'healthy', CURRENT_TIMESTAMP);
	`)
	if err != nil {
		t.Fatalf("failed to seed test data: %v", err)
	}

	// 1. Add Domain 1: apex with www redirect and canonical
	isCanon := true
	strip := true
	port := 3000
	authEn := true
	pPrefix := "/api"
	redMode := "www_to_non_www"
	authUser := "admin"
	authPw := "secret123"

	addReq1 := models.AddDomainRequest{
		Domain:       "example.com",
		Port:         &port,
		PathPrefix:   &pPrefix,
		StripPrefix:  &strip,
		IsCanonical:  &isCanon,
		RedirectMode: &redMode,
		AuthEnabled:  &authEn,
		AuthUser:     &authUser,
		AuthPassword: &authPw,
	}
	body1, _ := json.Marshal(addReq1)
	req1 := httptest.NewRequest(http.MethodPost, "/api/services/svc_main/domains", bytes.NewReader(body1))
	req1.AddCookie(cookie)
	rec1 := httptest.NewRecorder()
	r.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for domain 1, got %d: %s", rec1.Code, rec1.Body.String())
	}
	var dom1 models.Domain
	_ = json.Unmarshal(rec1.Body.Bytes(), &dom1)
	if !dom1.IsCanonical {
		t.Errorf("expected domain 1 to be canonical")
	}
	if dom1.RedirectMode != "www_to_non_www" {
		t.Errorf("expected redirect_mode www_to_non_www, got %s", dom1.RedirectMode)
	}
	if dom1.PathPrefix != "/api" || !dom1.StripPrefix {
		t.Errorf("expected path prefix /api with strip_prefix true, got path=%s strip=%v", dom1.PathPrefix, dom1.StripPrefix)
	}
	if !dom1.AuthEnabled || dom1.AuthUser != "admin" {
		t.Errorf("expected auth enabled with user admin, got enabled=%v user=%s", dom1.AuthEnabled, dom1.AuthUser)
	}

	// 2. Add Domain 2: alternative domain for same service
	port2 := 3000
	addReq2 := models.AddDomainRequest{
		Domain: "myapp.io",
		Port:   &port2,
	}
	body2, _ := json.Marshal(addReq2)
	req2 := httptest.NewRequest(http.MethodPost, "/api/services/svc_main/domains", bytes.NewReader(body2))
	req2.AddCookie(cookie)
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for domain 2, got %d: %s", rec2.Code, rec2.Body.String())
	}
	var dom2 models.Domain
	_ = json.Unmarshal(rec2.Body.Bytes(), &dom2)
	if dom2.IsCanonical {
		t.Errorf("expected domain 2 not to be canonical by default")
	}

	// 3. List domains for svc_main
	listReq := httptest.NewRequest(http.MethodGet, "/api/services/svc_main/domains", nil)
	listReq.AddCookie(cookie)
	listRec := httptest.NewRecorder()
	r.ServeHTTP(listRec, listReq)

	if listRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK listing domains, got %d", listRec.Code)
	}
	var list []models.Domain
	_ = json.Unmarshal(listRec.Body.Bytes(), &list)
	if len(list) != 2 {
		t.Fatalf("expected 2 domains, got %d", len(list))
	}
	if list[0].Domain != "example.com" || !list[0].IsCanonical {
		t.Errorf("expected first domain to be canonical example.com, got %s", list[0].Domain)
	}

	// 4. Update domain 2: designate it as canonical on svc_main and update redirect
	makeCanon := true
	newRedir := "non_www_to_www"
	updateReq := models.UpdateDomainRequest{
		IsCanonical:  &makeCanon,
		RedirectMode: &newRedir,
	}
	upBody, _ := json.Marshal(updateReq)
	patchReq := httptest.NewRequest(http.MethodPatch, "/api/services/svc_main/domains/myapp.io", bytes.NewReader(upBody))
	patchReq.AddCookie(cookie)
	patchRec := httptest.NewRecorder()
	r.ServeHTTP(patchRec, patchReq)

	if patchRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK updating domain, got %d: %s", patchRec.Code, patchRec.Body.String())
	}
	var updated models.Domain
	_ = json.Unmarshal(patchRec.Body.Bytes(), &updated)
	if !updated.IsCanonical || updated.RedirectMode != "non_www_to_www" {
		t.Errorf("unexpected updated domain state: %+v", updated)
	}

	// Verify dom1 is no longer canonical on svc_main
	var dom1Canon bool
	_ = database.QueryRow(`SELECT is_canonical FROM domains WHERE id = ?`, dom1.ID).Scan(&dom1Canon)
	if dom1Canon {
		t.Errorf("expected dom1 is_canonical to be false after updating dom2")
	}

	// 5. Delete domain 2 and verify canonical fallback
	delReq := httptest.NewRequest(http.MethodDelete, "/api/services/svc_main/domains/myapp.io", nil)
	delReq.AddCookie(cookie)
	delRec := httptest.NewRecorder()
	r.ServeHTTP(delRec, delReq)

	if delRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK deleting domain, got %d", delRec.Code)
	}
}

func TestAddDomain_RejectsConsoleDomain(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "console_domain_reject_test.db")

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	defer database.Close()

	masterKey := crypto.DeriveKey("test-secret-key-32-bytes-long!")
	authHandler, _ := auth.NewHandler(database, "console.example.com")
	h := NewHandler(database, masterKey, "console.example.com")

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

	_, err = database.Exec(`
		INSERT INTO servers (id, name, host, status, created_at)
		VALUES ('srv_node1', 'Worker 1', '203.0.113.10', 'online', CURRENT_TIMESTAMP);
		INSERT INTO projects (id, name, created_at)
		VALUES ('prj_1', 'Test Project', CURRENT_TIMESTAMP);
		INSERT INTO services (id, project_id, server_id, name, repository, branch, dockerfile_path, status, created_at)
		VALUES ('svc_1', 'prj_1', 'srv_node1', 'Web App', 'org/repo', 'main', 'Dockerfile', 'healthy', CURRENT_TIMESTAMP);
		UPDATE console_settings SET domain = 'custom-console.internal' WHERE id = 'default';
	`)
	if err != nil {
		t.Fatalf("failed to seed test data: %v", err)
	}

	testCases := []struct {
		name       string
		domain     string
		expectCode int
	}{
		{
			name:       "Exact match with h.domain",
			domain:     "console.example.com",
			expectCode: http.StatusBadRequest,
		},
		{
			name:       "Subdomain of h.domain",
			domain:     "api.console.example.com",
			expectCode: http.StatusBadRequest,
		},
		{
			name:       "Localhost domain",
			domain:     "localhost",
			expectCode: http.StatusBadRequest,
		},
		{
			name:       "Exact match with console_settings domain",
			domain:     "custom-console.internal",
			expectCode: http.StatusBadRequest,
		},
		{
			name:       "Subdomain of console_settings domain",
			domain:     "dash.custom-console.internal",
			expectCode: http.StatusBadRequest,
		},
		{
			name:       "Allowed custom domain",
			domain:     "app.myuserdomain.com",
			expectCode: http.StatusCreated,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(models.AddDomainRequest{
				Domain: tc.domain,
			})
			req := httptest.NewRequest(http.MethodPost, "/api/services/svc_1/domains", bytes.NewReader(body))
			req.AddCookie(cookie)
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)

			if rec.Code != tc.expectCode {
				t.Errorf("[%s] expected status %d for domain %s, got %d: %s", tc.name, tc.expectCode, tc.domain, rec.Code, rec.Body.String())
			}
			if tc.expectCode == http.StatusBadRequest && !strings.Contains(rec.Body.String(), "Cannot attach reserved control plane console domain") && tc.domain != "localhost" {
				t.Errorf("[%s] expected reserved domain error message, got: %s", tc.name, rec.Body.String())
			}
		})
	}
}

