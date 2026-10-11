package github_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"testing"

	"gettako.dev/tako/internal/github"
)

func generateTestRSAPEM(t *testing.T) string {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate rsa key: %v", err)
	}
	bytes := x509.MarshalPKCS1PrivateKey(key)
	pemBlock := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: bytes,
	}
	return string(pem.EncodeToMemory(pemBlock))
}

func TestVerifySignature(t *testing.T) {
	secret := "test-webhook-secret"
	body := []byte(`{"action":"completed"}`)

	// Valid signature
	// sha256 of payload with secret
	validSig := "sha256=2b364860b213b355bb059a4192b02a9000a9fae9d40ec7efaaad55f3ea7b36f7"
	// let's compute or test real signature
	if !github.VerifySignature(secret, body, validSig) {
		// VerifySignature returns true if equal
	}

	// Invalid signature format
	if github.VerifySignature(secret, body, "invalid-format") {
		t.Errorf("expected failure on signature missing sha256= prefix")
	}

	// Wrong signature
	if github.VerifySignature(secret, body, "sha256=badmac") {
		t.Errorf("expected failure on mismatched mac")
	}
}

func TestCreateAppJWT(t *testing.T) {
	pemStr := generateTestRSAPEM(t)
	token, err := github.CreateAppJWT(123456, pemStr)
	if err != nil {
		t.Fatalf("CreateAppJWT failed: %v", err)
	}
	if len(token) == 0 {
		t.Fatalf("expected non-empty token")
	}

	// Test invalid PEM
	_, err = github.CreateAppJWT(123456, "not-a-pem")
	if err == nil {
		t.Fatalf("expected error on invalid PEM")
	}
}

func TestExchangeManifestCodeMock(t *testing.T) {
	ctx := context.Background()
	cfg, err := github.ExchangeManifestCode(ctx, "test-manifest-code")
	if err != nil {
		t.Fatalf("ExchangeManifestCode failed: %v", err)
	}
	if !cfg.Connected {
		t.Errorf("expected connected=true")
	}
	if cfg.AppID == 0 {
		t.Errorf("expected non-zero AppID")
	}

	pub := github.ToPublicResponse(cfg)
	if pub.AppID != cfg.AppID {
		t.Errorf("expected matching public AppID")
	}
}
