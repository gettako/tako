package backup

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	_ "modernc.org/sqlite"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
)

type mockNodeSender struct {
	sentMsg *protocol.ServerMessage
	nodeID  string
	taskID  string
	ackErr  error
	ack     *protocol.TaskAck
}

func (m *mockNodeSender) SendTaskWithResponse(ctx context.Context, nodeID string, taskID string, msg *protocol.ServerMessage) (*protocol.TaskAck, error) {
	m.nodeID = nodeID
	m.taskID = taskID
	m.sentMsg = msg
	if m.ackErr != nil {
		return nil, m.ackErr
	}
	if m.ack != nil {
		return m.ack, nil
	}
	return &protocol.TaskAck{
		TaskId:          taskID,
		Success:         true,
		BackupSizeBytes: 1024,
	}, nil
}

func setupSchedulerTestDB(t *testing.T) (*sql.DB, string) {
	t.Helper()
	tmpDir, err := os.MkdirTemp("", "tako-scheduler-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	dbPath := filepath.Join(tmpDir, "test.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS s3_destinations (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		endpoint TEXT NOT NULL,
		region TEXT NOT NULL DEFAULT 'us-east-1',
		bucket_name TEXT NOT NULL,
		access_key_id TEXT NOT NULL,
		secret_access_key_enc BLOB NOT NULL,
		use_path_style BOOLEAN NOT NULL DEFAULT 0,
		is_default BOOLEAN NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS backup_configs (
		id TEXT PRIMARY KEY,
		service_id TEXT,
		s3_destination_id TEXT,
		enabled BOOLEAN NOT NULL DEFAULT 1,
		endpoint_url TEXT NOT NULL DEFAULT '',
		bucket TEXT NOT NULL DEFAULT '',
		region TEXT NOT NULL DEFAULT 'us-east-1',
		access_key TEXT NOT NULL DEFAULT '',
		secret_key_encrypted BLOB,
		secret_key_nonce BLOB,
		cron_expression TEXT NOT NULL DEFAULT '0 2 * * *',
		retention_count INTEGER NOT NULL DEFAULT 30,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
		s3_destination_id TEXT,
		error_message TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		completed_at DATETIME
	);

	CREATE TABLE IF NOT EXISTS services (
		id TEXT PRIMARY KEY,
		server_id TEXT NOT NULL,
		name TEXT NOT NULL,
		service_type TEXT NOT NULL,
		database_engine TEXT,
		database_name TEXT,
		database_user TEXT,
		database_password_encrypted BLOB,
		database_password_nonce BLOB,
		volume_name TEXT,
		volume_mount_path TEXT
	);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed to init schema: %v", err)
	}
	return db, tmpDir
}

func TestServiceBackupManager_ConfigLifecycle(t *testing.T) {
	db, tmpDir := setupSchedulerTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer db.Close()

	masterKey := crypto.DeriveKey("test-secret-passphrase")
	nodeSender := &mockNodeSender{}
	mgr := NewServiceBackupManager(db, masterKey, nodeSender)

	ctx := context.Background()

	// 1. Initial default config
	cfg, err := mgr.GetGlobalConfig(ctx)
	if err != nil {
		t.Fatalf("GetGlobalConfig failed: %v", err)
	}
	if cfg.ID != "global" {
		t.Fatalf("expected id 'global', got %s", cfg.ID)
	}
	if cfg.HasSecretKey {
		t.Fatal("expected no secret key initially")
	}

	// 2. Save config with secret key
	enabled := true
	bucket := "my-backups"
	endpoint := "https://s3.example.com"
	key := "s3-access-key"
	secret := "s3-super-secret"
	cron := "0 3 * * *"
	retention := 15

	updated, err := mgr.SaveGlobalConfig(ctx, models.UpdateBackupConfigRequest{
		Enabled:        &enabled,
		Bucket:         &bucket,
		EndpointURL:    &endpoint,
		AccessKey:      &key,
		SecretKey:      &secret,
		CronExpression: &cron,
		RetentionCount: &retention,
	})
	if err != nil {
		t.Fatalf("SaveGlobalConfig failed: %v", err)
	}
	if !updated.Enabled || updated.Bucket != bucket || !updated.HasSecretKey {
		t.Fatalf("updated config mismatch: %+v", updated)
	}

	// 3. Retrieve with decrypted secret
	cfg2, decSecret, err := mgr.GetGlobalConfigWithDecryptedSecret(ctx)
	if err != nil {
		t.Fatalf("GetGlobalConfigWithDecryptedSecret failed: %v", err)
	}
	if decSecret != secret {
		t.Fatalf("expected decrypted secret '%s', got '%s'", secret, decSecret)
	}
	if cfg2.RetentionCount != 15 {
		t.Fatalf("expected retention count 15, got %d", cfg2.RetentionCount)
	}
}

func TestServiceBackupManager_TriggerServiceBackup(t *testing.T) {
	db, tmpDir := setupSchedulerTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer db.Close()

	masterKey := crypto.DeriveKey("test-secret-passphrase")
	nodeSender := &mockNodeSender{}
	mgr := NewServiceBackupManager(db, masterKey, nodeSender)
	ctx := context.Background()

	// Configure S3
	enabled := true
	bucket := "test-bucket"
	access := "test-key"
	secret := "test-secret"
	_, _ = mgr.SaveGlobalConfig(ctx, models.UpdateBackupConfigRequest{
		Enabled:   &enabled,
		Bucket:    &bucket,
		AccessKey: &access,
		SecretKey: &secret,
	})

	// Insert database service
	encPass, nonce, _ := crypto.Encrypt([]byte("db-pass-123"), masterKey)
	_, err := db.Exec(`
		INSERT INTO services (id, server_id, name, service_type, database_engine, database_name, database_user, database_password_encrypted, database_password_nonce)
		VALUES ('srv-db-1', 'node-1', 'postgres-prod', 'database', 'postgres', 'proddb', 'postgres', ?, ?)
	`, encPass, nonce)
	if err != nil {
		t.Fatalf("failed to insert service: %v", err)
	}

	rec, err := mgr.TriggerServiceBackup(ctx, "srv-db-1", models.TriggerBackupRequest{})
	if err != nil {
		t.Fatalf("TriggerServiceBackup failed: %v", err)
	}

	if rec.ServiceID == nil || *rec.ServiceID != "srv-db-1" {
		t.Fatalf("unexpected service id: %+v", rec.ServiceID)
	}
	if rec.Status != models.BackupStatusRunning {
		t.Fatalf("expected status running, got %s", rec.Status)
	}
	if rec.BackupType != models.BackupTypeDatabase {
		t.Fatalf("expected database backup type, got %s", rec.BackupType)
	}
}

type mockStorageUploader struct {
	deletedKeys []string
}

func (m *mockStorageUploader) Upload(ctx context.Context, key string, reader io.Reader, size int64, contentType string) error {
	return nil
}
func (m *mockStorageUploader) GetPresignedURL(ctx context.Context, key string, expires time.Duration) (string, error) {
	return "https://download/" + key, nil
}
func (m *mockStorageUploader) Delete(ctx context.Context, key string) error {
	m.deletedKeys = append(m.deletedKeys, key)
	return nil
}

func TestServiceBackupManager_DestinationRetention(t *testing.T) {
	db, tmpDir := setupSchedulerTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer db.Close()

	masterKey := crypto.DeriveKey("test-secret-passphrase")
	mgr := NewServiceBackupManager(db, masterKey, &mockNodeSender{})
	ctx := context.Background()

	// Insert S3 destinations
	ciphertext, nonce, _ := crypto.Encrypt([]byte("secret-1"), masterKey)
	secEnc1 := append(nonce, ciphertext...)
	_, _ = db.Exec(`
		INSERT INTO s3_destinations (id, name, endpoint, bucket_name, access_key_id, secret_access_key_enc, is_default)
		VALUES ('dest-1', 'Dest 1', 'https://s3.1.com', 'bkt-1', 'key-1', ?, 1)
	`, secEnc1)

	ciphertext2, nonce2, _ := crypto.Encrypt([]byte("secret-2"), masterKey)
	secEnc2 := append(nonce2, ciphertext2...)
	_, _ = db.Exec(`
		INSERT INTO s3_destinations (id, name, endpoint, bucket_name, access_key_id, secret_access_key_enc, is_default)
		VALUES ('dest-2', 'Dest 2', 'https://s3.2.com', 'bkt-2', 'key-2', ?, 0)
	`, secEnc2)

	// Resolve destination with nil should return default 'dest-1'
	resolvedDefault, err := mgr.ResolveS3Destination(ctx, nil)
	if err != nil || resolvedDefault.ID != "dest-1" {
		t.Fatalf("expected default destination dest-1, got %+v (err: %v)", resolvedDefault, err)
	}

	// Resolve destination with 'dest-2' should return dest-2
	d2 := "dest-2"
	resolved2, err := mgr.ResolveS3Destination(ctx, &d2)
	if err != nil || resolved2.ID != "dest-2" {
		t.Fatalf("expected dest-2, got %+v (err: %v)", resolved2, err)
	}

	// Insert 4 completed backups for srv-1 on dest-1
	for i := 1; i <= 4; i++ {
		_, _ = db.Exec(`
			INSERT INTO backup_records (id, service_id, backup_type, status, file_name, s3_key, s3_destination_id, created_at)
			VALUES (?, 'srv-1', 'database', 'completed', ?, ?, 'dest-1', datetime('now', ?))
		`, fmt.Sprintf("bkp-%d", i), fmt.Sprintf("file-%d.gz", i), fmt.Sprintf("backups/file-%d.gz", i), fmt.Sprintf("-%d hours", 5-i))
	}

	// Test retention with mock uploader retaining only 2
	mockUp := &mockStorageUploader{}
	destID := "dest-1"
	err = mgr.EnforceServiceRetention(ctx, "srv-1", &destID, 2, mockUp)
	if err != nil {
		t.Fatalf("EnforceServiceRetention failed: %v", err)
	}

	if len(mockUp.deletedKeys) != 2 {
		t.Fatalf("expected 2 deleted files from mock uploader, got %d", len(mockUp.deletedKeys))
	}

	// Check remaining records in DB for srv-1
	var count int
	_ = db.QueryRow("SELECT count(*) FROM backup_records WHERE service_id = 'srv-1' AND s3_destination_id = 'dest-1'").Scan(&count)
	if count != 2 {
		t.Fatalf("expected 2 remaining records, got %d", count)
	}
}

