package crypto

import (
	"strings"
	"testing"

	"golang.org/x/crypto/ssh"
)

func TestGenerateSSHKeyPair(t *testing.T) {
	serviceID := "svc_12345"
	pair, err := GenerateSSHKeyPair(serviceID)
	if err != nil {
		t.Fatalf("failed to generate key pair: %v", err)
	}

	if !strings.HasPrefix(pair.PublicKey, "ssh-ed25519 ") {
		t.Errorf("expected public key to start with 'ssh-ed25519 ', got %s", pair.PublicKey)
	}

	expectedComment := "tako-service-" + serviceID
	if !strings.HasSuffix(pair.PublicKey, expectedComment) {
		t.Errorf("expected public key to end with comment %q, got %s", expectedComment, pair.PublicKey)
	}

	signer, err := ssh.ParsePrivateKey(pair.PrivateKeyPEM)
	if err != nil {
		t.Fatalf("failed to parse generated private key: %v", err)
	}

	if signer.PublicKey().Type() != "ssh-ed25519" {
		t.Errorf("expected signer public key type ssh-ed25519, got %s", signer.PublicKey().Type())
	}
}

func TestGenerateAndEncryptSSHKeyPair(t *testing.T) {
	masterKey := make([]byte, 32)
	copy(masterKey, "test-master-key-32-bytes-long!!!")

	serviceID := "svc_secure"
	pubKey, encrypted, nonce, err := GenerateAndEncryptSSHKeyPair(serviceID, masterKey)
	if err != nil {
		t.Fatalf("failed to generate and encrypt key pair: %v", err)
	}

	if pubKey == "" || len(encrypted) == 0 || len(nonce) == 0 {
		t.Fatalf("unexpected empty outputs: pubKey=%q, encLen=%d, nonceLen=%d", pubKey, len(encrypted), len(nonce))
	}

	decryptedPEM, err := Decrypt(encrypted, nonce, masterKey)
	if err != nil {
		t.Fatalf("failed to decrypt private key: %v", err)
	}

	signer, err := ssh.ParsePrivateKey(decryptedPEM)
	if err != nil {
		t.Fatalf("failed to parse decrypted private key: %v", err)
	}

	if signer.PublicKey().Type() != "ssh-ed25519" {
		t.Errorf("expected signer type ssh-ed25519, got %s", signer.PublicKey().Type())
	}
}
