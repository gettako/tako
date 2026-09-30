package auth

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
)

type WebAuthnService struct {
	db       *sql.DB
	wa       *webauthn.WebAuthn
	sessions map[string]*webauthnSessionEntry
	mu       sync.Mutex
}

type webauthnSessionEntry struct {
	data      *webauthn.SessionData
	createdAt time.Time
}

func NewWebAuthnService(db *sql.DB, domain string) (*WebAuthnService, error) {
	if domain == "" {
		domain = "localhost"
	}

	origins := []string{
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://" + domain,
		"https://" + domain,
	}
	if domain != "localhost" && domain != "127.0.0.1" {
		origins = append(origins, "http://localhost:8080", "http://127.0.0.1:8080")
	}

	rpID := domain
	if net.ParseIP(domain) != nil {
		rpID = "localhost"
	}

	wa, err := webauthn.New(&webauthn.Config{
		RPDisplayName: "Tako Control Plane",
		RPID:          rpID,
		RPOrigins:     origins,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to init webauthn: %w", err)
	}

	return &WebAuthnService{
		db:       db,
		wa:       wa,
		sessions: make(map[string]*webauthnSessionEntry),
	}, nil
}

func (u *User) WebAuthnID() []byte {
	return []byte(u.ID)
}

func (u *User) WebAuthnName() string {
	return u.Email
}

func (u *User) WebAuthnDisplayName() string {
	return u.Name
}

func (u *User) WebAuthnCredentials() []webauthn.Credential {
	return nil
}

// UserWithCredentials wraps User to supply stored credentials to WebAuthn.
type UserWithCredentials struct {
	*User
	Credentials []webauthn.Credential
}

func (u *UserWithCredentials) WebAuthnCredentials() []webauthn.Credential {
	return u.Credentials
}

func (s *WebAuthnService) LoadUserCredentials(user *User) (*UserWithCredentials, error) {
	rows, err := s.db.Query(`SELECT credential FROM passkeys WHERE user_id = ?`, user.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var creds []webauthn.Credential
	for rows.Next() {
		var credBlob []byte
		if err := rows.Scan(&credBlob); err != nil {
			continue
		}
		var cred webauthn.Credential
		if err := json.Unmarshal(credBlob, &cred); err == nil {
			creds = append(creds, cred)
		}
	}

	return &UserWithCredentials{
		User:        user,
		Credentials: creds,
	}, nil
}

func (s *WebAuthnService) SaveSession(key string, sessionData *webauthn.SessionData) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[key] = &webauthnSessionEntry{
		data:      sessionData,
		createdAt: time.Now(),
	}
}

func (s *WebAuthnService) GetSession(key string) (*webauthn.SessionData, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.sessions[key]
	if !ok {
		return nil, false
	}
	if time.Since(entry.createdAt) > 5*time.Minute {
		delete(s.sessions, key)
		return nil, false
	}
	delete(s.sessions, key)
	return entry.data, true
}
