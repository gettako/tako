package handlers_test

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	_ "modernc.org/sqlite"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/server/handlers"
)

func setupStorageTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory sqlite: %v", err)
	}

	schema := `
	CREATE TABLE s3_destinations (
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

	CREATE TABLE backup_configs (
		id TEXT PRIMARY KEY,
		service_id TEXT,
		s3_destination_id TEXT REFERENCES s3_destinations(id),
		enabled BOOLEAN NOT NULL DEFAULT 1,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("failed to create schema: %v", err)
	}
	return db
}

func TestStorageHandlers_Lifecycle(t *testing.T) {
	db := setupStorageTestDB(t)
	defer db.Close()

	masterKey := []byte("01234567890123456789012345678901")
	h := handlers.NewHandler(db, masterKey, "localhost")

	r := chi.NewRouter()
	r.Get("/api/storage/s3", h.ListS3Destinations)
	r.Post("/api/storage/s3", h.CreateS3Destination)
	r.Patch("/api/storage/s3/{id}", h.UpdateS3Destination)
	r.Delete("/api/storage/s3/{id}", h.DeleteS3Destination)
	r.Post("/api/storage/s3/{id}/test", h.TestS3Destination)
	r.Post("/api/storage/s3/test", h.TestS3DestinationRaw)

	// 1. Initial list should be empty
	req := httptest.NewRequest(http.MethodGet, "/api/storage/s3", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var list []models.S3Destination
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if len(list) != 0 {
		t.Fatalf("expected 0 destinations, got %d", len(list))
	}

	// 2. Create first destination (AWS S3) - should automatically become default
	createBody1 := models.CreateS3DestinationRequest{
		Name:            "Primary AWS S3",
		Endpoint:        "https://s3.us-east-1.amazonaws.com",
		Region:          ptrStr("us-east-1"),
		BucketName:      "my-prod-backups",
		AccessKeyID:     "AKIAIOSFODNN7EXAMPLE",
		SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
		UsePathStyle:    ptrBool(false),
	}
	bodyBytes, _ := json.Marshal(createBody1)
	req = httptest.NewRequest(http.MethodPost, "/api/storage/s3", bytes.NewReader(bodyBytes))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var dest1 models.S3Destination
	if err := json.Unmarshal(rec.Body.Bytes(), &dest1); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	if dest1.ID == "" || dest1.Name != "Primary AWS S3" {
		t.Fatalf("unexpected destination: %+v", dest1)
	}
	if !dest1.IsDefault {
		t.Fatalf("expected first destination to be marked as default")
	}

	// Verify encryption in DB: secret_access_key_enc must not contain plaintext
	var encBytes []byte
	err := db.QueryRow("SELECT secret_access_key_enc FROM s3_destinations WHERE id = ?", dest1.ID).Scan(&encBytes)
	if err != nil {
		t.Fatalf("failed to query encrypted secret: %v", err)
	}
	if bytes.Contains(encBytes, []byte("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")) {
		t.Fatal("secret key was stored in plaintext, expected encryption")
	}
	// Verify it decrypts with masterKey
	nonce := encBytes[:12]
	ciphertext := encBytes[12:]
	decrypted, err := crypto.Decrypt(ciphertext, nonce, masterKey)
	if err != nil {
		t.Fatalf("failed to decrypt stored credentials: %v", err)
	}
	if string(decrypted) != "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" {
		t.Fatalf("expected decrypted secret to match, got %s", string(decrypted))
	}

	// 3. Create second destination (Cloudflare R2) with is_default = true
	createBody2 := models.CreateS3DestinationRequest{
		Name:            "Cloudflare R2",
		Endpoint:        "https://abc123456789.r2.cloudflarestorage.com",
		Region:          ptrStr("auto"),
		BucketName:      "r2-backups",
		AccessKeyID:     "r2-access-key-id",
		SecretAccessKey: "r2-secret-access-key",
		UsePathStyle:    ptrBool(false),
		IsDefault:       ptrBool(true),
	}
	bodyBytes, _ = json.Marshal(createBody2)
	req = httptest.NewRequest(http.MethodPost, "/api/storage/s3", bytes.NewReader(bodyBytes))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var dest2 models.S3Destination
	if err := json.Unmarshal(rec.Body.Bytes(), &dest2); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	if !dest2.IsDefault {
		t.Fatalf("expected dest2 to be default")
	}

	// Verify only ONE destination is default now (dest1 should have is_default = 0)
	var dest1IsDefault bool
	_ = db.QueryRow("SELECT is_default FROM s3_destinations WHERE id = ?", dest1.ID).Scan(&dest1IsDefault)
	if dest1IsDefault {
		t.Fatalf("expected dest1 is_default to be false after dest2 set default")
	}

	// 4. Update dest1: change name and set back to default
	updateBody := models.UpdateS3DestinationRequest{
		Name:      ptrStr("AWS S3 East Production"),
		IsDefault: ptrBool(true),
	}
	bodyBytes, _ = json.Marshal(updateBody)
	req = httptest.NewRequest(http.MethodPatch, "/api/storage/s3/"+dest1.ID, bytes.NewReader(bodyBytes))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on update, got %d: %s", rec.Code, rec.Body.String())
	}
	var updatedDest1 models.S3Destination
	_ = json.Unmarshal(rec.Body.Bytes(), &updatedDest1)
	if updatedDest1.Name != "AWS S3 East Production" || !updatedDest1.IsDefault {
		t.Fatalf("unexpected updated dest1: %+v", updatedDest1)
	}

	// Verify dest2 is now not default
	var dest2IsDefault bool
	_ = db.QueryRow("SELECT is_default FROM s3_destinations WHERE id = ?", dest2.ID).Scan(&dest2IsDefault)
	if dest2IsDefault {
		t.Fatalf("expected dest2 is_default to be false after dest1 set default")
	}

	// 5. Delete protection: bind dest1 to active backup_config
	_, err = db.Exec("INSERT INTO backup_configs (id, s3_destination_id, enabled) VALUES ('cfg-1', ?, 1)", dest1.ID)
	if err != nil {
		t.Fatalf("failed to insert backup config: %v", err)
	}

	req = httptest.NewRequest(http.MethodDelete, "/api/storage/s3/"+dest1.ID, nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict when deleting bound destination, got %d: %s", rec.Code, rec.Body.String())
	}

	// Unbind or disable backup_config
	_, _ = db.Exec("UPDATE backup_configs SET enabled = 0 WHERE id = 'cfg-1'")
	req = httptest.NewRequest(http.MethodDelete, "/api/storage/s3/"+dest1.ID, nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK after unbinding, got %d: %s", rec.Code, rec.Body.String())
	}

	// Verify dest1 deleted
	var remainingCount int
	_ = db.QueryRow("SELECT count(*) FROM s3_destinations WHERE id = ?", dest1.ID).Scan(&remainingCount)
	if remainingCount != 0 {
		t.Fatalf("expected dest1 to be deleted from database")
	}
}

func TestStorageHandlers_Validation(t *testing.T) {
	db := setupStorageTestDB(t)
	defer db.Close()

	masterKey := []byte("01234567890123456789012345678901")
	h := handlers.NewHandler(db, masterKey, "localhost")

	r := chi.NewRouter()
	r.Post("/api/storage/s3", h.CreateS3Destination)
	r.Post("/api/storage/s3/test", h.TestS3DestinationRaw)

	// Missing required fields on create
	req := httptest.NewRequest(http.MethodPost, "/api/storage/s3", bytes.NewReader([]byte(`{"name":""}`)))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty name, got %d", rec.Code)
	}

	// Missing required fields on test raw
	req = httptest.NewRequest(http.MethodPost, "/api/storage/s3/test", bytes.NewReader([]byte(`{}`)))
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing test params, got %d", rec.Code)
	}
}
