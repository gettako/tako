package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"
)

const SessionCookieName = "tako_session"
const SessionDuration = 7 * 24 * time.Hour

type User struct {
	ID               string    `json:"id"`
	Email            string    `json:"email"`
	Name             string    `json:"name"`
	Role             string    `json:"role"`
	PasswordHash     string    `json:"-"`
	TwoFactorEnabled bool      `json:"two_factor_enabled"`
	TwoFactorSecret  string    `json:"-"`
	RecoveryCodes    string    `json:"-"`
	PasskeysEnabled  bool      `json:"passkeys_enabled"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type Session struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

func GenerateSessionID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "sess_" + hex.EncodeToString(bytes), nil
}

func CreateSession(db *sql.DB, userID string) (*Session, error) {
	sessionID, err := GenerateSessionID()
	if err != nil {
		return nil, fmt.Errorf("generate session id: %w", err)
	}

	expiresAt := time.Now().Add(SessionDuration)
	_, err = db.Exec(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`, sessionID, userID, expiresAt)
	if err != nil {
		return nil, fmt.Errorf("insert session: %w", err)
	}

	return &Session{
		ID:        sessionID,
		UserID:    userID,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}, nil
}

func DeleteSession(db *sql.DB, sessionID string) error {
	_, err := db.Exec(`DELETE FROM sessions WHERE id = ?`, sessionID)
	return err
}

func isSecureCookie(domain string) bool {
	if os.Getenv("TAKO_COOKIE_SECURE") == "false" {
		return false
	}
	if os.Getenv("TAKO_COOKIE_SECURE") == "true" {
		return true
	}
	if domain == "localhost" || domain == "127.0.0.1" || domain == "" || net.ParseIP(domain) != nil {
		return false
	}
	return true
}

func SetSessionCookie(w http.ResponseWriter, sessionID string, domain string, expiresAt time.Time) {
	isSecure := isSecureCookie(domain)
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    sessionID,
		Path:     "/",
		Expires:  expiresAt,
		MaxAge:   int(time.Until(expiresAt).Seconds()),
		HttpOnly: true,
		Secure:   isSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func ClearSessionCookie(w http.ResponseWriter, domain string) {
	isSecure := isSecureCookie(domain)
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   isSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func GetUserBySessionID(db *sql.DB, sessionID string) (*User, error) {
	query := `
		SELECT u.id, u.email, u.name, COALESCE(u.role, 'member'), u.password_hash, u.two_factor_enabled, 
		       COALESCE(u.two_factor_secret, ''), COALESCE(u.recovery_codes, ''),
		       u.passkeys_enabled, u.created_at, u.updated_at
		FROM users u
		JOIN sessions s ON u.id = s.user_id
		WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP
	`
	row := db.QueryRow(query, sessionID)

	var u User
	var createdAtStr, updatedAtStr string
	err := row.Scan(
		&u.ID, &u.Email, &u.Name, &u.Role, &u.PasswordHash,
		&u.TwoFactorEnabled, &u.TwoFactorSecret, &u.RecoveryCodes,
		&u.PasskeysEnabled, &createdAtStr, &updatedAtStr,
	)
	if err != nil {
		return nil, err
	}

	u.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
	if u.CreatedAt.IsZero() {
		u.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
	}
	u.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)
	if u.UpdatedAt.IsZero() {
		u.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAtStr)
	}

	return &u, nil
}
