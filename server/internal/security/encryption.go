// Package security provides AES-256-GCM envelope encryption and decryption for sensitive
// cluster credentials such as environment secrets, GitHub webhooks, and registry passwords.
package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"strings"
)

var defaultKey []byte

func init() {
	keyStr := os.Getenv("TAKO_ENCRYPTION_KEY")
	if keyStr == "" {
		keyStr = os.Getenv("TAKO_AUTH_SECRET")
	}
	if keyStr == "" {
		keyStr = os.Getenv("TAKO_AGENT_SECRET")
	}
	if keyStr == "" {
		keyStr = "tako-default-cluster-encryption-seed-v1"
	}
	h := sha256.Sum256([]byte(keyStr))
	defaultKey = h[:]
}

// Encrypt encrypts plaintext using AES-256-GCM.
func Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	block, err := aes.NewCipher(defaultKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return "enc:v1:" + base64.RawURLEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts an "enc:v1:..." string. If not prefixed, returns as-is.
func Decrypt(data string) (string, error) {
	if !strings.HasPrefix(data, "enc:v1:") {
		return data, nil
	}
	raw := strings.TrimPrefix(data, "enc:v1:")
	ciphertext, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return data, err
	}
	block, err := aes.NewCipher(defaultKey)
	if err != nil {
		return data, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return data, err
	}
	if len(ciphertext) < gcm.NonceSize() {
		return data, errors.New("malformed ciphertext")
	}
	nonce := ciphertext[:gcm.NonceSize()]
	actualCipher := ciphertext[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, actualCipher, nil)
	if err != nil {
		return data, err
	}
	return string(plain), nil
}
