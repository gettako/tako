package crypto

import (
	"bytes"
	"crypto/rand"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func TestEncryptDecryptVaryingLengths(t *testing.T) {
	masterKey := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, masterKey); err != nil {
		t.Fatalf("failed to generate random key: %v", err)
	}

	lengths := []int{1, 16, 64, 256, 1024, 65536, 1048576} // 1 byte to 1 MB

	for _, length := range lengths {
		plaintext := make([]byte, length)
		if _, err := io.ReadFull(rand.Reader, plaintext); err != nil {
			t.Fatalf("failed to generate plaintext of length %d: %v", length, err)
		}

		ciphertext, nonce, err := Encrypt(plaintext, masterKey)
		if err != nil {
			t.Fatalf("Encrypt failed for length %d: %v", length, err)
		}

		decrypted, err := Decrypt(ciphertext, nonce, masterKey)
		if err != nil {
			t.Fatalf("Decrypt failed for length %d: %v", length, err)
		}

		if !bytes.Equal(plaintext, decrypted) {
			t.Fatalf("decrypted text does not match plaintext for length %d", length)
		}
	}
}

func TestTamperedCiphertextDetection(t *testing.T) {
	masterKey := make([]byte, 32)
	_, _ = io.ReadFull(rand.Reader, masterKey)

	plaintext := []byte("confidential-tako-database-secret")
	ciphertext, nonce, err := Encrypt(plaintext, masterKey)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	// Tamper with ciphertext
	tamperedCiphertext := make([]byte, len(ciphertext))
	copy(tamperedCiphertext, ciphertext)
	tamperedCiphertext[len(tamperedCiphertext)-1] ^= 0xFF

	_, err = Decrypt(tamperedCiphertext, nonce, masterKey)
	if err == nil {
		t.Fatal("expected error decrypting tampered ciphertext, got nil")
	}

	// Tamper with nonce
	tamperedNonce := make([]byte, len(nonce))
	copy(tamperedNonce, nonce)
	tamperedNonce[0] ^= 0x01

	_, err = Decrypt(ciphertext, tamperedNonce, masterKey)
	if err == nil {
		t.Fatal("expected error decrypting with tampered nonce, got nil")
	}

	// Tamper with key
	wrongKey := make([]byte, 32)
	_, _ = io.ReadFull(rand.Reader, wrongKey)
	_, err = Decrypt(ciphertext, nonce, wrongKey)
	if err == nil {
		t.Fatal("expected error decrypting with wrong key, got nil")
	}
}

func TestUniqueNonces(t *testing.T) {
	masterKey := make([]byte, 32)
	_, _ = io.ReadFull(rand.Reader, masterKey)
	plaintext := []byte("constant-plaintext")

	_, nonce1, err := Encrypt(plaintext, masterKey)
	if err != nil {
		t.Fatalf("Encrypt 1 failed: %v", err)
	}

	_, nonce2, err := Encrypt(plaintext, masterKey)
	if err != nil {
		t.Fatalf("Encrypt 2 failed: %v", err)
	}

	if bytes.Equal(nonce1, nonce2) {
		t.Fatal("nonces must be unique across multiple encryption operations")
	}
}

func TestMasterKeyGenerationAndPermissions(t *testing.T) {
	tempDir := t.TempDir()
	keyPath := filepath.Join(tempDir, "master.key")

	key, err := LoadOrGenerateMasterKey("", keyPath)
	if err != nil {
		t.Fatalf("LoadOrGenerateMasterKey failed: %v", err)
	}

	if len(key) != 32 {
		t.Fatalf("expected 32-byte key, got %d bytes", len(key))
	}

	info, err := os.Stat(keyPath)
	if err != nil {
		t.Fatalf("failed to stat key file: %v", err)
	}

	perm := info.Mode().Perm()
	if perm != 0600 {
		t.Errorf("expected file permissions 0600, got %o", perm)
	}

	// Load existing key
	loadedKey, err := LoadOrGenerateMasterKey("", keyPath)
	if err != nil {
		t.Fatalf("re-loading key failed: %v", err)
	}
	if !bytes.Equal(key, loadedKey) {
		t.Fatal("re-loaded key did not match generated key")
	}

	// Test secretKey override
	derived := DeriveKey("my-passphrase")
	envLoadedKey, err := LoadOrGenerateMasterKey("my-passphrase", keyPath)
	if err != nil {
		t.Fatalf("loading key from secretKey failed: %v", err)
	}
	if !bytes.Equal(derived, envLoadedKey) {
		t.Fatal("derived key did not match secretKey key")
	}
}

func TestKeyVersioningAndLegacyCompatibility(t *testing.T) {
	masterKey := DeriveKey("secure-passphrase-for-testing")
	plaintext := []byte("top-secret-environment-variable-value")

	// 1. Versioned encryption should have v1: prefix
	ciphertext, nonce, err := Encrypt(plaintext, masterKey)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}
	if !bytes.HasPrefix(ciphertext, []byte("v1:")) {
		t.Fatalf("expected ciphertext to have 'v1:' prefix, got: %x", ciphertext[:3])
	}

	// 2. Decrypt versioned ciphertext
	decrypted, err := Decrypt(ciphertext, nonce, masterKey)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}
	if !bytes.Equal(plaintext, decrypted) {
		t.Fatalf("decrypted text mismatch: got %s, want %s", string(decrypted), string(plaintext))
	}

	// 3. Legacy compatibility: ciphertext without v1: prefix
	legacyCiphertext := ciphertext[3:] // strip v1: prefix
	decryptedLegacy, err := Decrypt(legacyCiphertext, nonce, masterKey)
	if err != nil {
		t.Fatalf("Decrypt legacy ciphertext failed: %v", err)
	}
	if !bytes.Equal(plaintext, decryptedLegacy) {
		t.Fatalf("decrypted legacy text mismatch: got %s, want %s", string(decryptedLegacy), string(plaintext))
	}

	// 4. Unsupported future version: v2:
	unsupportedCiphertext := append([]byte("v2:"), legacyCiphertext...)
	_, err = Decrypt(unsupportedCiphertext, nonce, masterKey)
	if err == nil {
		t.Fatal("expected error decrypting unsupported v2 version, got nil")
	}

	// 5. Test EncryptVersioned and DecryptVersioned
	payload, err := EncryptVersioned(plaintext, masterKey)
	if err != nil {
		t.Fatalf("EncryptVersioned failed: %v", err)
	}
	decryptedPayload, err := DecryptVersioned(payload, masterKey)
	if err != nil {
		t.Fatalf("DecryptVersioned failed: %v", err)
	}
	if !bytes.Equal(plaintext, decryptedPayload) {
		t.Fatalf("decrypted payload mismatch: got %s, want %s", string(decryptedPayload), string(plaintext))
	}
}

func TestRejectTruncatedKeysAndCiphertexts(t *testing.T) {
	validKey := DeriveKey("valid-32-byte-master-key-seed")
	plaintext := []byte("some-confidential-secret")

	// 1. Truncated key (e.g. 16 or 31 bytes)
	shortKey := validKey[:16]
	_, _, err := Encrypt(plaintext, shortKey)
	if err != ErrInvalidKeySize {
		t.Fatalf("expected ErrInvalidKeySize on Encrypt, got: %v", err)
	}

	ciphertext, nonce, err := Encrypt(plaintext, validKey)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	_, err = Decrypt(ciphertext, nonce, shortKey)
	if err != ErrInvalidKeySize {
		t.Fatalf("expected ErrInvalidKeySize on Decrypt, got: %v", err)
	}

	// 2. Truncated nonce
	shortNonce := nonce[:8]
	_, err = Decrypt(ciphertext, shortNonce, validKey)
	if err != ErrInvalidNonceSize {
		t.Fatalf("expected ErrInvalidNonceSize, got: %v", err)
	}

	// 3. Truncated ciphertext (< 16 bytes auth tag)
	truncatedCiphertext := []byte("v1:short")
	_, err = Decrypt(truncatedCiphertext, nonce, validKey)
	if err != ErrCiphertextTruncated {
		t.Fatalf("expected ErrCiphertextTruncated, got: %v", err)
	}
}

