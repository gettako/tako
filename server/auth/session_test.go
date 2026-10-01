package auth

import (
	"path/filepath"
	"testing"
	"time"

	"gettako.dev/tako/server/db"
)

func TestSessionExpiry(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "session_test.db")

	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	defer database.Close()

	// 1. Create a user
	userID := "usr_test_expiry"
	_, err = database.Exec(`
		INSERT INTO users (id, email, name, password_hash, role)
		VALUES (?, 'test@gettako.dev', 'Test User', 'hashedpassword', 'admin')
	`, userID)
	if err != nil {
		t.Fatalf("failed to insert user: %v", err)
	}

	// 2. Create a valid session
	session, err := CreateSession(database, userID)
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	if session == nil {
		t.Fatal("expected session to not be nil")
	}

	// Verify expiry is approximately 30 days in the future
	durationUntilExpiry := time.Until(session.ExpiresAt)
	if durationUntilExpiry < 29*24*time.Hour || durationUntilExpiry > 31*24*time.Hour {
		t.Fatalf("expected session expiry to be ~30 days, got duration: %v", durationUntilExpiry)
	}

	// 3. Valid session returns normal user via GetSession
	user, err := GetSession(database, session.ID)
	if err != nil {
		t.Fatalf("expected GetSession to succeed for valid session, got error: %v", err)
	}
	if user == nil {
		t.Fatal("expected user to not be nil for valid session")
	}
	if user.ID != userID {
		t.Errorf("expected user ID %s, got %s", userID, user.ID)
	}
	if user.Email != "test@gettako.dev" {
		t.Errorf("expected email test@gettako.dev, got %s", user.Email)
	}

	// Also verify GetUserBySessionID alias returns the same user
	aliasUser, err := GetUserBySessionID(database, session.ID)
	if err != nil {
		t.Fatalf("expected GetUserBySessionID to succeed for valid session: %v", err)
	}
	if aliasUser == nil || aliasUser.ID != userID {
		t.Fatalf("expected aliasUser ID %s, got %+v", userID, aliasUser)
	}

	// 4. Create an expired session in the past (using datetime('now', '-1 day'))
	expiredSessionID := "sess_expired_test"
	_, err = database.Exec(`
		INSERT INTO sessions (id, user_id, expires_at)
		VALUES (?, ?, datetime('now', '-1 day'))
	`, expiredSessionID, userID)
	if err != nil {
		t.Fatalf("failed to insert expired session: %v", err)
	}

	// 5. Expired session returns nil/error on GetSession
	expiredUser, err := GetSession(database, expiredSessionID)
	if err == nil && expiredUser != nil {
		t.Fatalf("expected GetSession to fail/return nil for expired session, got user: %+v", expiredUser)
	}

	// Verify that lazy cleanup removed the expired session from the sessions table
	var count int
	err = database.QueryRow(`SELECT count(*) FROM sessions WHERE id = ?`, expiredSessionID).Scan(&count)
	if err != nil {
		t.Fatalf("failed to query sessions count: %v", err)
	}
	if count != 0 {
		t.Errorf("expected expired session to be cleaned up from database, but count was %d", count)
	}

	// 6. Test explicit CleanupExpiredSessions
	anotherExpiredID := "sess_expired_cleanup"
	_, err = database.Exec(`
		INSERT INTO sessions (id, user_id, expires_at)
		VALUES (?, ?, datetime('now', '-2 hours'))
	`, anotherExpiredID, userID)
	if err != nil {
		t.Fatalf("failed to insert expired session for cleanup test: %v", err)
	}

	if err := CleanupExpiredSessions(database); err != nil {
		t.Fatalf("CleanupExpiredSessions returned error: %v", err)
	}

	err = database.QueryRow(`SELECT count(*) FROM sessions WHERE id = ?`, anotherExpiredID).Scan(&count)
	if err != nil {
		t.Fatalf("failed to query sessions count after cleanup: %v", err)
	}
	if count != 0 {
		t.Errorf("expected another expired session to be cleaned up, but count was %d", count)
	}

	// Ensure the active session was NOT deleted by cleanup
	activeUser, err := GetSession(database, session.ID)
	if err != nil || activeUser == nil {
		t.Fatalf("expected active session to remain valid after cleanup: %v", err)
	}
}
