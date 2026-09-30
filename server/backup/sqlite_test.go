package backup

import (
	"bytes"
	"compress/gzip"
	"context"
	"database/sql"
	"io"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

type mockUploader struct {
	mu       sync.Mutex
	uploaded map[string][]byte
	deleted  []string
}

func newMockUploader() *mockUploader {
	return &mockUploader{
		uploaded: make(map[string][]byte),
	}
}

func (m *mockUploader) Upload(ctx context.Context, key string, body io.Reader, size int64, contentType string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	data, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	m.uploaded[key] = data
	return nil
}

func (m *mockUploader) Delete(ctx context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.uploaded, key)
	m.deleted = append(m.deleted, key)
	return nil
}

func setupTestDB(t *testing.T) (*sql.DB, string) {
	t.Helper()
	tmpDir, err := os.MkdirTemp("", "tako-backup-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	dbPath := filepath.Join(tmpDir, "test.db")

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	pragmas := []string{
		"PRAGMA journal_mode=WAL;",
		"PRAGMA synchronous=NORMAL;",
		"PRAGMA foreign_keys=ON;",
	}
	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			t.Fatalf("pragma failed: %v", err)
		}
	}

	// Schema for tests
	schema := `
	CREATE TABLE IF NOT EXISTS sample_data (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		val TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS backup_records (
		id TEXT PRIMARY KEY,
		service_id TEXT,
		server_id TEXT,
		backup_type TEXT NOT NULL,
		database_engine TEXT,
		status TEXT NOT NULL DEFAULT 'pending',
		file_name TEXT NOT NULL,
		s3_key TEXT NOT NULL,
		file_size_bytes INTEGER NOT NULL DEFAULT 0,
		error_message TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		completed_at DATETIME
	);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed to exec schema: %v", err)
	}

	return db, tmpDir
}

func TestBackupSQLiteControlPlane_Success(t *testing.T) {
	db, tmpDir := setupTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer db.Close()

	// Insert test data
	for i := 0; i < 50; i++ {
		_, err := db.Exec("INSERT INTO sample_data (val) VALUES (?)", "test-row")
		if err != nil {
			t.Fatalf("failed to insert sample data: %v", err)
		}
	}

	mockUp := newMockUploader()
	ctx := context.Background()

	record, err := BackupSQLiteControlPlane(ctx, db, mockUp, 5)
	if err != nil {
		t.Fatalf("BackupSQLiteControlPlane failed: %v", err)
	}

	if record == nil {
		t.Fatal("expected record to be non-nil")
	}
	if record.Status != "completed" {
		t.Fatalf("expected status completed, got %s", record.Status)
	}
	if record.FileSizeBytes <= 0 {
		t.Fatalf("expected positive file size, got %d", record.FileSizeBytes)
	}

	// Verify upload
	mockUp.mu.Lock()
	uploadedData, exists := mockUp.uploaded[record.S3Key]
	mockUp.mu.Unlock()
	if !exists {
		t.Fatalf("expected s3_key %s to be uploaded", record.S3Key)
	}

	// Verify it is a valid gzip stream
	gzReader, err := gzip.NewReader(bytes.NewReader(uploadedData))
	if err != nil {
		t.Fatalf("uploaded data is not valid gzip: %v", err)
	}
	defer gzReader.Close()
}

func TestBackupSQLiteControlPlane_Retention(t *testing.T) {
	db, tmpDir := setupTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer db.Close()

	mockUp := newMockUploader()
	ctx := context.Background()

	// Create 4 backups with retention limit of 2
	for i := 0; i < 4; i++ {
		time.Sleep(10 * time.Millisecond) // distinct timestamps
		_, err := BackupSQLiteControlPlane(ctx, db, mockUp, 2)
		if err != nil {
			t.Fatalf("backup %d failed: %v", i, err)
		}
	}

	// Should only have 2 records in database
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM backup_records WHERE backup_type = 'control_plane'").Scan(&count)
	if err != nil {
		t.Fatalf("failed to count records: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 records after retention cleanup, got %d", count)
	}

	// Mock uploader should have deleted 2 backups
	mockUp.mu.Lock()
	deletedCount := len(mockUp.deleted)
	activeCount := len(mockUp.uploaded)
	mockUp.mu.Unlock()

	if deletedCount != 2 {
		t.Fatalf("expected 2 backups deleted from S3, got %d", deletedCount)
	}
	if activeCount != 2 {
		t.Fatalf("expected 2 active backups in S3, got %d", activeCount)
	}
}
