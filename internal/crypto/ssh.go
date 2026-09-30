package crypto

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"
	"fmt"
	"strings"

	"golang.org/x/crypto/ssh"
)

type SSHKeyPair struct {
	PublicKey     string
	PrivateKeyPEM []byte
}

// GenerateSSHKeyPair generates a new Ed25519 SSH keypair, returning the OpenSSH public key
// and PEM-encoded private key.
func GenerateSSHKeyPair(serviceID string) (*SSHKeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate ed25519 key: %w", err)
	}

	sshPub, err := ssh.NewPublicKey(pub)
	if err != nil {
		return nil, fmt.Errorf("failed to create ssh public key: %w", err)
	}

	comment := fmt.Sprintf("tako-service-%s", serviceID)
	pubKeyStr := fmt.Sprintf("%s %s", strings.TrimSpace(string(ssh.MarshalAuthorizedKey(sshPub))), comment)

	pemBlock, err := ssh.MarshalPrivateKey(priv, comment)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal private key: %w", err)
	}

	privKeyPEM := pem.EncodeToMemory(pemBlock)

	return &SSHKeyPair{
		PublicKey:     pubKeyStr,
		PrivateKeyPEM: privKeyPEM,
	}, nil
}

// GenerateAndEncryptSSHKeyPair generates a keypair and encrypts the private key using AES-256-GCM.
func GenerateAndEncryptSSHKeyPair(serviceID string, masterKey []byte) (string, []byte, []byte, error) {
	pair, err := GenerateSSHKeyPair(serviceID)
	if err != nil {
		return "", nil, nil, err
	}

	encrypted, nonce, err := Encrypt(pair.PrivateKeyPEM, masterKey)
	if err != nil {
		return "", nil, nil, fmt.Errorf("failed to encrypt ssh private key: %w", err)
	}

	return pair.PublicKey, encrypted, nonce, nil
}
