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
	now := time.Now().UTC()
	// Periodic eviction when session map grows
	if len(s.sessions) > 500 {
		for t, existing := range s.sessions {
			if now.After(existing.ExpiresAt) {
				delete(s.sessions, t)
			}
		}
	}
	sess := UserSession{
		Token:     token,
		UserID:    user.ID,
		UserRole:  user.Role,
		CreatedAt: now,
		ExpiresAt: now.Add(7 * 24 * time.Hour),
	}
	s.sessions[token] = sess
	return sess
}

// Get looks up a session by token, returning false if missing or expired.
func (s *SessionStore) Get(token string) (UserSession, bool) {
	s.mu.RLock()
	sess, ok := s.sessions[token]
	s.mu.RUnlock()
	if !ok {
		return UserSession{}, false
	}
	if time.Now().UTC().After(sess.ExpiresAt) {
		s.Revoke(token)
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

// PruneExpired purges all sessions that have passed their expiration deadline.
func (s *SessionStore) PruneExpired() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now().UTC()
	pruned := 0
	for token, sess := range s.sessions {
		if now.After(sess.ExpiresAt) {
			delete(s.sessions, token)
			pruned++
		}
	}
	return pruned
}

