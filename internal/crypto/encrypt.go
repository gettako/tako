package crypto

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"golang.org/x/crypto/hkdf"
)

const CurrentKeyVersion = "v1"

var (
	ErrInvalidKeySize      = errors.New("master key must be 32 bytes for AES-256")
	ErrInvalidNonceSize    = errors.New("invalid nonce size for AES-GCM")
	ErrUnsupportedVersion  = errors.New("unsupported ciphertext key version")
	ErrCiphertextTruncated = errors.New("ciphertext is truncated or invalid")
)

// Encrypt encrypts plaintext using AES-256-GCM with a freshly generated random 96-bit nonce.
// The resulting ciphertext is prefixed with the version identifier ("v1:").
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

	sealed := gcm.Seal(nil, nonce, plaintext, nil)
	versionPrefix := []byte(CurrentKeyVersion + ":")
	ciphertext = make([]byte, len(versionPrefix)+len(sealed))
	copy(ciphertext, versionPrefix)
	copy(ciphertext[len(versionPrefix):], sealed)

	return ciphertext, nonce, nil
}

// Decrypt decrypts AES-256-GCM ciphertext using the given nonce and master key.
// It supports versioned ciphertexts (prefixed with "v1:") as well as unversioned/legacy ciphertexts.
func Decrypt(ciphertext []byte, nonce []byte, masterKey []byte) (plaintext []byte, err error) {
	if len(masterKey) != 32 {
		return nil, ErrInvalidKeySize
	}

	if len(nonce) != 12 {
		return nil, ErrInvalidNonceSize
	}

	// Check for version identifier prefix (e.g. "v1:", "v2:")
	if len(ciphertext) >= 3 && ciphertext[0] == 'v' && ciphertext[2] == ':' {
		ver := string(ciphertext[:2])
		if ver == CurrentKeyVersion {
			ciphertext = ciphertext[3:]
		} else {
			return nil, fmt.Errorf("%w: %s", ErrUnsupportedVersion, ver)
		}
	}

	if len(ciphertext) < 16 {
		return nil, ErrCiphertextTruncated
	}

	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, fmt.Errorf("create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create gcm: %w", err)
	}

	plaintext, err = gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt ciphertext: %w", err)
	}

	return plaintext, nil
}

// EncryptVersioned encrypts plaintext into a self-contained payload format: "v1:" + nonce (12 bytes) + sealed ciphertext
func EncryptVersioned(plaintext []byte, masterKey []byte) ([]byte, error) {
	ciphertext, nonce, err := Encrypt(plaintext, masterKey)
	if err != nil {
		return nil, err
	}
	sealed := ciphertext[3:]
	payload := make([]byte, 0, 3+len(nonce)+len(sealed))
	payload = append(payload, []byte(CurrentKeyVersion+":")...)
	payload = append(payload, nonce...)
	payload = append(payload, sealed...)
	return payload, nil
}

// DecryptVersioned decrypts a self-contained payload format.
func DecryptVersioned(payload []byte, masterKey []byte) ([]byte, error) {
	if len(masterKey) != 32 {
		return nil, ErrInvalidKeySize
	}
	if len(payload) >= 15 && bytes.HasPrefix(payload, []byte("v1:")) {
		nonce := payload[3:15]
		ciphertext := payload[15:]
		return Decrypt(ciphertext, nonce, masterKey)
	}
	if len(payload) >= 28 {
		nonce := payload[:12]
		ciphertext := payload[12:]
		return Decrypt(ciphertext, nonce, masterKey)
	}
	return nil, ErrCiphertextTruncated
}

// DeriveKey derives a deterministic 32-byte AES-256 key from a passphrase using HKDF-SHA256 (RFC 5869)
// with the info tag "tako-master-key-v1".
func DeriveKey(passphrase string) []byte {
	return DeriveKeyWithSalt(passphrase, nil)
}

// DeriveKeyWithSalt derives a 32-byte key from a passphrase and optional salt using HKDF-SHA256.
func DeriveKeyWithSalt(passphrase string, salt []byte) []byte {
	kdf := hkdf.New(sha256.New, []byte(passphrase), salt, []byte("tako-master-key-v1"))
	key := make([]byte, 32)
	if _, err := io.ReadFull(kdf, key); err != nil {
		hash := sha256.Sum256([]byte(passphrase))
		copy(key, hash[:])
	}
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
