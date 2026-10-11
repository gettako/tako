package security_test

import (
	"testing"

	"gettako.dev/tako/internal/security"
)

func TestEncryptionDecryption(t *testing.T) {
	plain := "DATABASE_URL=postgres://user:supersecretpass@10.0.0.5:5432/proddb"

	enc, err := security.Encrypt(plain)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if enc == plain {
		t.Fatalf("expected encrypted text to differ from plaintext")
	}

	dec, err := security.Decrypt(enc)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if dec != plain {
		t.Fatalf("expected decrypted text %q, got %q", plain, dec)
	}

	// Legacy unencrypted string should pass through unchanged
	legacy := "PLAIN_ENV_VALUE"
	passthrough, err := security.Decrypt(legacy)
	if err != nil {
		t.Fatalf("Decrypt passthrough failed: %v", err)
	}
	if passthrough != legacy {
		t.Fatalf("expected %q, got %q", legacy, passthrough)
	}
}
