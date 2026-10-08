package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
)

func TestDomainSettingsAndVerification(t *testing.T) {
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

	// 1. Test PUT with invalid domain format -> returns 400
	invalidPayload, _ := json.Marshal(map[string]any{
		"value": map[string]any{
			"domain": "invalid..domain..com",
		},
	})
	reqInvalid := httptest.NewRequest(http.MethodPut, "/api/v1/settings/domain_settings", bytes.NewReader(invalidPayload))
	reqInvalid.Header.Set("Content-Type", "application/json")
	wInvalid := httptest.NewRecorder()
	router.ServeHTTP(wInvalid, reqInvalid)
	if wInvalid.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for invalid domain, got %d: %s", wInvalid.Code, wInvalid.Body.String())
	}

	// 2. Test PUT /api/v1/settings/domain_settings with valid domain
	putPayload, _ := json.Marshal(map[string]any{
		"value": map[string]any{
			"domain":       "console.gettako.dev",
			"sslAutoRenew": true,
			"customDnsIp":  "43.156.243.241",
		},
	})
	reqPut := httptest.NewRequest(http.MethodPut, "/api/v1/settings/domain_settings", bytes.NewReader(putPayload))
	reqPut.Header.Set("Content-Type", "application/json")
	wPut := httptest.NewRecorder()
	router.ServeHTTP(wPut, reqPut)
	if wPut.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for PUT domain_settings, got %d: %s", wPut.Code, wPut.Body.String())
	}

	// 3. Test GET /api/v1/settings/domain_settings
	reqGet := httptest.NewRequest(http.MethodGet, "/api/v1/settings/domain_settings", nil)
	wGet := httptest.NewRecorder()
	router.ServeHTTP(wGet, reqGet)
	if wGet.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for GET domain_settings, got %d: %s", wGet.Code, wGet.Body.String())
	}

	var dsMap map[string]any
	if err := json.Unmarshal(wGet.Body.Bytes(), &dsMap); err != nil {
		t.Fatalf("failed to parse GET domain_settings: %v", err)
	}
	if dsMap["domain"] != "console.gettako.dev" {
		t.Fatalf("expected domain console.gettako.dev, got %v", dsMap["domain"])
	}

	// 4. Test POST /api/v1/settings/domain/verify with localhost
	verifyPayload, _ := json.Marshal(map[string]any{
		"domain":     "localhost",
		"expectedIp": "127.0.0.1",
	})
	reqVerify := httptest.NewRequest(http.MethodPost, "/api/v1/settings/domain/verify", bytes.NewReader(verifyPayload))
	reqVerify.Header.Set("Content-Type", "application/json")
	wVerify := httptest.NewRecorder()
	router.ServeHTTP(wVerify, reqVerify)
	if wVerify.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for verify domain, got %d: %s", wVerify.Code, wVerify.Body.String())
	}

	var vResp VerifyDomainResponse
	if err := json.Unmarshal(wVerify.Body.Bytes(), &vResp); err != nil {
		t.Fatalf("failed to parse verify response: %v", err)
	}
	if !vResp.Valid || !vResp.DnsVerified {
		t.Fatalf("expected valid and dnsVerified for localhost, got valid=%v dnsVerified=%v", vResp.Valid, vResp.DnsVerified)
	}

	// 5. Test POST /api/v1/settings/domain/verify with sslip.io domain
	sslipPayload, _ := json.Marshal(map[string]any{
		"domain":     "app-43-156-243-241.sslip.io",
		"expectedIp": "43.156.243.241",
	})
	reqSslip := httptest.NewRequest(http.MethodPost, "/api/v1/settings/domain/verify", bytes.NewReader(sslipPayload))
	reqSslip.Header.Set("Content-Type", "application/json")
	wSslip := httptest.NewRecorder()
	router.ServeHTTP(wSslip, reqSslip)
	if wSslip.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for sslip.io verification, got %d: %s", wSslip.Code, wSslip.Body.String())
	}

	var sResp VerifyDomainResponse
	if err := json.Unmarshal(wSslip.Body.Bytes(), &sResp); err != nil {
		t.Fatalf("failed to parse sslip response: %v", err)
	}
	if !sResp.DnsVerified {
		t.Fatalf("expected sslip.io DNS to be verified, got %v", sResp.DnsVerified)
	}

	// 6. Verify audit log was created for domain verification
	auditReq := httptest.NewRequest(http.MethodGet, "/api/v1/audit-logs", nil)
	wAudit := httptest.NewRecorder()
	router.ServeHTTP(wAudit, auditReq)
	if wAudit.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for audit logs, got %d", wAudit.Code)
	}
	var logs []AuditLogResponse
	_ = json.Unmarshal(wAudit.Body.Bytes(), &logs)
	foundAudit := false
	for _, l := range logs {
		if l.Action == "verify_cluster_domain" {
			foundAudit = true
			break
		}
	}
	if !foundAudit {
		t.Fatalf("expected verify_cluster_domain audit log entry, found none in %d logs", len(logs))
	}
}
