package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

var (
	ErrInvalidKeySize   = errors.New("master key must be 32 bytes for AES-256")
	ErrInvalidNonceSize = errors.New("invalid nonce size for AES-GCM")
)

// Encrypt encrypts plaintext using AES-256-GCM with a freshly generated random 96-bit nonce.
func Encrypt(plaintext []byte, masterKey []byte) (ciphertext []byte, nonce []byte, err error) {
	if len(masterKey) != 32 {
		return nil, nil, ErrInvalidKeySize
	}

	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, nil, fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("create gcm: %w", err)
	}

	nonce = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext = gcm.Seal(nil, nonce, plaintext, nil)
	return ciphertext, nonce, nil
}

// Decrypt decrypts AES-256-GCM ciphertext using the given nonce and master key.
func Decrypt(ciphertext []byte, nonce []byte, masterKey []byte) (plaintext []byte, err error) {
	if len(masterKey) != 32 {
		return nil, ErrInvalidKeySize
	}

	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create gcm: %w", err)
	}

	if len(nonce) != gcm.NonceSize() {
		return nil, ErrInvalidNonceSize
	}

	plaintext, err = gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt ciphertext: %w", err)
	}

	return plaintext, nil
}

// DeriveKey derives a deterministic 32-byte AES-256 key from a passphrase.
func DeriveKey(passphrase string) []byte {
	hash := sha256.Sum256([]byte(passphrase))
	key := make([]byte, 32)
	copy(key, hash[:])
	return key
}

// LoadOrGenerateMasterKey loads the master key from secretKey env or keyPath file,
// generating and persisting a new 32-byte key with 0600 permissions if none exists.
func LoadOrGenerateMasterKey(secretKey string, keyPath string) ([]byte, error) {
	if secretKey != "" {
		return DeriveKey(secretKey), nil
	}

	if keyPath == "" {
		keyPath = "/etc/tako/master.key"
	}

	// Try reading existing key file
	data, err := os.ReadFile(keyPath)
	if err == nil {
		if len(data) == 32 {
			return data, nil
		}
		if len(data) > 0 {
			return DeriveKey(string(data)), nil
		}
	}

	// Auto-generate a new 32-byte key
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("failed to generate random master key: %w", err)
	}

	dir := filepath.Dir(keyPath)
	if dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0700); err != nil {
			// Fallback to local directory if system directory is not writable
			keyPath = "./master.key"
		}
	}

	if err := os.WriteFile(keyPath, key, 0600); err != nil {
		// Attempt fallback to current working directory
		fallbackPath := "./master.key"
		if fbErr := os.WriteFile(fallbackPath, key, 0600); fbErr != nil {
			return nil, fmt.Errorf("failed to persist master key to %s or %s: %w", keyPath, fallbackPath, err)
		}
	}

	return key, nil
}
