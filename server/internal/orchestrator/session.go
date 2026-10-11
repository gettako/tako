package orchestrator

import (
	"sync"
	"time"

	"gettako.dev/tako/internal/store/db"
)

type UserSession struct {
	Token     string
	UserID    string
	UserRole  string
	CreatedAt time.Time
	ExpiresAt time.Time
}

type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]UserSession
}

func NewSessionStore() *SessionStore {
	return &SessionStore{
		sessions: make(map[string]UserSession),
	}
}

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

func (s *SessionStore) Get(token string) (UserSession, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[token]
	if !ok || time.Now().UTC().After(sess.ExpiresAt) {
		return UserSession{}, false
	}
	return sess, true
}

func (s *SessionStore) Revoke(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, token)
}
