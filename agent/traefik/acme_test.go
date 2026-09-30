package traefik

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func generateTestCertPEM(t *testing.T, domain string, sans []string, notBefore, notAfter time.Time) string {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			CommonName: domain,
		},
		NotBefore:             notBefore,
		NotAfter:              notAfter,
		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              sans,
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		t.Fatalf("failed to create certificate: %v", err)
	}

	pemBlock := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
	return string(pemBlock)
}

func TestACMETracker(t *testing.T) {
	tempDir := t.TempDir()
	acmeFile := filepath.Join(tempDir, "acme.json")

	// 1. Nonexistent acme.json should return empty without error
	tracker := NewACMETracker(acmeFile)
	certs, err := tracker.ParseCertificates()
	if err != nil {
		t.Fatalf("expected no error for nonexistent file, got %v", err)
	}
	if len(certs) != 0 {
		t.Fatalf("expected 0 certs, got %d", len(certs))
	}

	// 2. Write valid acme.json with one active and one expired cert
	activePEM := generateTestCertPEM(t, "app.example.com", []string{"api.example.com"}, time.Now().Add(-1*time.Hour), time.Now().Add(90*24*time.Hour))
	expiredPEM := generateTestCertPEM(t, "old.example.com", nil, time.Now().Add(-60*24*time.Hour), time.Now().Add(-1*time.Hour))

	acmeData := map[string]interface{}{
		"letsencrypt": map[string]interface{}{
			"Certificates": []map[string]interface{}{
				{
					"domain": map[string]interface{}{
						"main": "app.example.com",
						"sans": []string{"api.example.com"},
					},
					"certificate": base64.StdEncoding.EncodeToString([]byte(activePEM)),
				},
				{
					"domain": map[string]interface{}{
						"main": "old.example.com",
					},
					"certificate": base64.StdEncoding.EncodeToString([]byte(expiredPEM)),
				},
			},
		},
	}

	rawJSON, err := json.MarshalIndent(acmeData, "", "  ")
	if err != nil {
		t.Fatalf("failed to marshal acme data: %v", err)
	}

	if err := os.WriteFile(acmeFile, rawJSON, 0600); err != nil {
		t.Fatalf("failed to write acme file: %v", err)
	}

	// Check active domain
	info := tracker.CheckDomain("app.example.com")
	if info.Status != "active" {
		t.Errorf("expected status active, got %s (err: %s)", info.Status, info.ErrorMessage)
	}
	if info.ExpiresAt.Before(time.Now()) {
		t.Errorf("expected expiresAt in future, got %v", info.ExpiresAt)
	}

	// Check SAN domain
	sanInfo := tracker.CheckDomain("api.example.com")
	if sanInfo.Status != "active" {
		t.Errorf("expected san status active, got %s", sanInfo.Status)
	}

	// Check expired domain
	expInfo := tracker.CheckDomain("old.example.com")
	if expInfo.Status != "error" {
		t.Errorf("expected expired status error, got %s", expInfo.Status)
	}

	// Check unissued / pending domain
	pendingInfo := tracker.CheckDomain("unknown.example.com")
	if pendingInfo.Status != "pending" {
		t.Errorf("expected unknown domain status pending, got %s", pendingInfo.Status)
	}

	// Test ScanAll
	scanned := tracker.ScanAll([]string{"app.example.com", "unknown.example.com", "old.example.com"})
	if len(scanned) != 3 {
		t.Fatalf("expected 3 results from scan, got %d", len(scanned))
	}
	if scanned[0].Status != "active" || scanned[1].Status != "pending" || scanned[2].Status != "error" {
		t.Errorf("unexpected scan statuses: %+v", scanned)
	}
}
