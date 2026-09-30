package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/go-chi/chi/v5"
	_ "modernc.org/sqlite"

	"gettako.dev/tako/server/backup"
	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
)

type mockBackupNodeManager struct {
	taskAck *protocol.TaskAck
}

func (m *mockBackupNodeManager) SendTaskWithResponse(ctx context.Context, nodeID string, taskID string, msg *protocol.ServerMessage) (*protocol.TaskAck, error) {
	if m.taskAck != nil {
		return m.taskAck, nil
	}
	return &protocol.TaskAck{
		TaskId:          taskID,
		Success:         true,
		BackupSizeBytes: 2048,
	}, nil
}

func setupBackupTestDB(t *testing.T) (*sql.DB, string) {
	t.Helper()
	tmpDir, err := os.MkdirTemp("", "tako-handler-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	dbPath := filepath.Join(tmpDir, "test.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	db.SetMaxOpenConns(1)
	_, _ = db.Exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
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
		t.Fatalf("failed to initialize test schema: %v", err)
	}
	return db, tmpDir
}

func TestBackupHandlers_SettingsEndpoints(t *testing.T) {
	db, tmpDir := setupBackupTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer db.Close()

	masterKey := crypto.DeriveKey("test-master-key")
	h := NewHandler(db, masterKey, "test.local")

	r := chi.NewRouter()
	r.Get("/settings/backup", h.GetBackupConfig)
	r.Put("/settings/backup", h.UpdateBackupConfig)
	r.Post("/settings/backup/test", h.TestBackupStorage)
	r.Get("/settings/backup/records", h.ListControlPlaneBackups)

	// 1. GET initial config
	req := httptest.NewRequest("GET", "/settings/backup", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var cfg models.BackupConfig
	if err := json.Unmarshal(rec.Body.Bytes(), &cfg); err != nil {
		t.Fatalf("failed to parse json: %v", err)
	}
	if cfg.ID != "global" {
		t.Fatalf("expected global id, got %s", cfg.ID)
	}

	// 2. PUT update config
	enabled := true
	bucket := "my-s3-bucket"
	access := "AKIAEXAMPLE"
	secret := "secret-12345"
	cron := "0 1 * * *"
	retention := 20
	updateBody, _ := json.Marshal(models.UpdateBackupConfigRequest{
		Enabled:        &enabled,
		Bucket:         &bucket,
		AccessKey:      &access,
		SecretKey:      &secret,
		CronExpression: &cron,
		RetentionCount: &retention,
	})

	req = httptest.NewRequest("PUT", "/settings/backup", bytes.NewReader(updateBody))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var updatedCfg models.BackupConfig
	_ = json.Unmarshal(rec.Body.Bytes(), &updatedCfg)
	if !updatedCfg.HasSecretKey || updatedCfg.Bucket != bucket {
		t.Fatalf("unexpected updated config: %+v", updatedCfg)
	}

	// 3. GET control plane records
	req = httptest.NewRequest("GET", "/settings/backup/records", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var records []models.BackupRecord
	_ = json.Unmarshal(rec.Body.Bytes(), &records)
	if len(records) != 0 {
		t.Fatalf("expected 0 initial records, got %d", len(records))
	}
}

func TestBackupHandlers_ServiceBackups(t *testing.T) {
	db, tmpDir := setupBackupTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer db.Close()

	masterKey := crypto.DeriveKey("test-master-key")
	h := NewHandler(db, masterKey, "test.local")
	h.SetBackupManager(backup.NewServiceBackupManager(db, masterKey, &mockBackupNodeManager{}))

	// Pre-configure S3
	enabled := true
	bucket := "test-bucket"
	access := "test-key"
	secret := "test-secret"
	bm := h.ensureBackupManager()
	_, _ = bm.SaveGlobalConfig(context.Background(), models.UpdateBackupConfigRequest{
		Enabled:   &enabled,
		Bucket:    &bucket,
		AccessKey: &access,
		SecretKey: &secret,
	})

	// Insert test database service
	_, _ = db.Exec(`
		INSERT INTO services (id, server_id, name, service_type, database_engine, database_name, database_user)
		VALUES ('srv-pg-1', 'node-1', 'postgres-test', 'database', 'postgres', 'testdb', 'postgres')
	`)

	r := chi.NewRouter()
	r.Get("/services/{id}/backups", h.ListServiceBackups)
	r.Post("/services/{id}/backups", h.TriggerServiceBackup)

	// Trigger backup
	req := httptest.NewRequest("POST", "/services/srv-pg-1/backups", bytes.NewReader([]byte(`{}`)))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var recResult models.BackupRecord
	if err := json.Unmarshal(rec.Body.Bytes(), &recResult); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if recResult.Status != models.BackupStatusRunning {
		t.Fatalf("expected status running, got %s", recResult.Status)
	}

	// List backups
	req = httptest.NewRequest("GET", "/services/srv-pg-1/backups", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var list []models.BackupRecord
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list) != 1 {
		t.Fatalf("expected 1 record, got %d", len(list))
	}
}

func TestBackupHandlers_S3DestinationAndSchedule(t *testing.T) {
	db, tmpDir := setupBackupTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer db.Close()

	masterKey := crypto.DeriveKey("test-master-key")
	h := NewHandler(db, masterKey, "test.local")
	h.SetBackupManager(backup.NewServiceBackupManager(db, masterKey, &mockBackupNodeManager{}))

	// Insert S3 destination
	ciphertext, nonce, err := crypto.Encrypt([]byte("dest-secret-123"), masterKey)
	if err != nil {
		t.Fatalf("failed to encrypt secret: %v", err)
	}
	secretEnc := append(nonce, ciphertext...)
	_, err = db.Exec(`
		INSERT INTO s3_destinations (id, name, endpoint, region, bucket_name, access_key_id, secret_access_key_enc, is_default)
		VALUES ('s3d-primary', 'Primary Wasabi', 'https://s3.wasabisys.com', 'us-east-1', 'prod-backups', 'wasabi-key', ?, 1)
	`, secretEnc)
	if err != nil {
		t.Fatalf("failed to insert s3 destination: %v", err)
	}

	// Insert test database service
	_, _ = db.Exec(`
		INSERT INTO services (id, server_id, name, service_type, database_engine, database_name, database_user)
		VALUES ('srv-redis-1', 'node-1', 'redis-prod', 'database', 'redis', 'db0', '')
	`)

	r := chi.NewRouter()
	r.Get("/services/{id}/backups", h.ListServiceBackups)
	r.Post("/services/{id}/backups", h.TriggerServiceBackup)
	r.Get("/services/{id}/backup-schedule", h.GetServiceBackupSchedule)
	r.Put("/services/{id}/backup-schedule", h.UpdateServiceBackupSchedule)

	// 1. Get default unconfigured schedule
	req := httptest.NewRequest("GET", "/services/srv-redis-1/backup-schedule", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var sched models.ServiceBackupSchedule
	_ = json.Unmarshal(rec.Body.Bytes(), &sched)
	if sched.Enabled {
		t.Fatalf("expected default schedule to be disabled")
	}

	// 2. Update schedule to enable automated backups with s3d-primary
	enable := true
	cronExpr := "0 3 * * *"
	retCount := 14
	destID := "s3d-primary"
	upReqBody, _ := json.Marshal(models.UpdateBackupScheduleRequest{
		Enabled:         &enable,
		S3DestinationID: &destID,
		CronExpression:  &cronExpr,
		RetentionCount:  &retCount,
	})
	req = httptest.NewRequest("PUT", "/services/srv-redis-1/backup-schedule", bytes.NewReader(upReqBody))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var updatedSched models.ServiceBackupSchedule
	_ = json.Unmarshal(rec.Body.Bytes(), &updatedSched)
	if !updatedSched.Enabled || updatedSched.RetentionCount != 14 || updatedSched.S3DestinationID == nil || *updatedSched.S3DestinationID != "s3d-primary" {
		t.Fatalf("unexpected updated schedule: %+v", updatedSched)
	}

	// 3. Trigger on-demand backup with target S3 destination
	trigBody, _ := json.Marshal(models.TriggerBackupRequest{
		S3DestinationID: &destID,
	})
	req = httptest.NewRequest("POST", "/services/srv-redis-1/backups", bytes.NewReader(trigBody))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var bkp models.BackupRecord
	_ = json.Unmarshal(rec.Body.Bytes(), &bkp)
	if bkp.S3DestinationID == nil || *bkp.S3DestinationID != "s3d-primary" {
		t.Fatalf("expected s3_destination_id 's3d-primary', got %v", bkp.S3DestinationID)
	}
	if bkp.S3DestinationName == nil || *bkp.S3DestinationName != "Primary Wasabi" {
		t.Fatalf("expected destination name 'Primary Wasabi', got %v", bkp.S3DestinationName)
	}

	// 4. List service backups and verify destination label is returned
	req = httptest.NewRequest("GET", "/services/srv-redis-1/backups", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var list []models.BackupRecord
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list) != 1 || list[0].S3DestinationName == nil || *list[0].S3DestinationName != "Primary Wasabi" {
		t.Fatalf("unexpected backup list results: %+v", list)
	}
}

