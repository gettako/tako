package orchestrator

import (
	"sync"
	"time"

	"gettako.dev/tako/internal/store/db"
)

// UserSession represents an authenticated console user session with role and expiration timestamp.
type UserSession struct {
	Token     string
	UserID    string
	UserRole  string
	CreatedAt time.Time
	ExpiresAt time.Time
}

// SessionStore maintains an in-memory thread-safe cache of active user sessions.
type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]UserSession
}

// NewSessionStore creates an initialized SessionStore.
func NewSessionStore() *SessionStore {
	return &SessionStore{
		sessions: make(map[string]UserSession),
	}
}

// Register stores a new authenticated session for user valid for 7 days.
func (s *SessionStore) Register(token string, user db.User) UserSession {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess := UserSession{
		Token:     token,
		UserID:    user.ID,
		UserRole:  user.Role,
		CreatedAt: time.Now().UTC(),
		ExpiresAt: time.Now().UTC().Add(7 * 24 * time.Hour),
	}
	s.sessions[token] = sess
	return sess
}

// Get looks up a session by token, returning false if missing or expired.
func (s *SessionStore) Get(token string) (UserSession, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[token]
	if !ok || time.Now().UTC().After(sess.ExpiresAt) {
		return UserSession{}, false
	}
	return sess, true
}

// Revoke deletes a session on logout.
func (s *SessionStore) Revoke(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, token)
}
