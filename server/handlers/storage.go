package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/storage"
)

// ListS3Destinations returns all configured S3 storage destinations.
func (h *Handler) ListS3Destinations(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		sendError(w, http.StatusInternalServerError, "Database not available")
		return
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, name, endpoint, region, bucket_name, access_key_id,
		       use_path_style, is_default, created_at, updated_at
		FROM s3_destinations
		ORDER BY is_default DESC, created_at ASC
	`)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to query S3 destinations: "+err.Error())
		return
	}
	defer rows.Close()

	destinations := make([]models.S3Destination, 0)
	for rows.Next() {
		var dest models.S3Destination
		var usePathStyle, isDefault bool
		if err := rows.Scan(
			&dest.ID,
			&dest.Name,
			&dest.Endpoint,
			&dest.Region,
			&dest.BucketName,
			&dest.AccessKeyID,
			&usePathStyle,
			&isDefault,
			&dest.CreatedAt,
			&dest.UpdatedAt,
		); err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to read S3 destinations: "+err.Error())
			return
		}
		dest.UsePathStyle = usePathStyle
		dest.IsDefault = isDefault
		destinations = append(destinations, dest)
	}

	sendJSON(w, http.StatusOK, destinations)
}

// CreateS3Destination registers a new S3 storage destination with encrypted credentials.
func (h *Handler) CreateS3Destination(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		sendError(w, http.StatusInternalServerError, "Database not available")
		return
	}

	var req models.CreateS3DestinationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	name := strings.TrimSpace(req.Name)
	endpoint := strings.TrimSpace(req.Endpoint)
	bucketName := strings.TrimSpace(req.BucketName)
	accessKeyID := strings.TrimSpace(req.AccessKeyID)
	secretAccessKey := strings.TrimSpace(req.SecretAccessKey)

	if name == "" {
		sendError(w, http.StatusBadRequest, "name is required")
		return
	}
	if endpoint == "" {
		sendError(w, http.StatusBadRequest, "endpoint is required")
		return
	}
	if bucketName == "" {
		sendError(w, http.StatusBadRequest, "bucket_name is required")
		return
	}
	if accessKeyID == "" {
		sendError(w, http.StatusBadRequest, "access_key_id is required")
		return
	}
	if secretAccessKey == "" {
		sendError(w, http.StatusBadRequest, "secret_access_key is required")
		return
	}

	region := "us-east-1"
	if req.Region != nil && strings.TrimSpace(*req.Region) != "" {
		region = strings.TrimSpace(*req.Region)
	}

	usePathStyle := false
	if req.UsePathStyle != nil {
		usePathStyle = *req.UsePathStyle
	}

	ciphertext, nonce, err := crypto.Encrypt([]byte(secretAccessKey), h.masterKey)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to encrypt credentials: "+err.Error())
		return
	}
	secretAccessKeyEnc := append(nonce, ciphertext...)

	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Transaction error: "+err.Error())
		return
	}
	defer tx.Rollback()

	var existingCount int
	if err := tx.QueryRowContext(r.Context(), "SELECT count(*) FROM s3_destinations").Scan(&existingCount); err != nil {
		sendError(w, http.StatusInternalServerError, "Database error: "+err.Error())
		return
	}

	isDefault := false
	if req.IsDefault != nil {
		isDefault = *req.IsDefault
	} else if existingCount == 0 {
		isDefault = true
	}

	if isDefault {
		if _, err := tx.ExecContext(r.Context(), "UPDATE s3_destinations SET is_default = 0"); err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to update default destinations: "+err.Error())
			return
		}
	}

	id := generateID("s3d")
	now := time.Now()

	_, err = tx.ExecContext(r.Context(), `
		INSERT INTO s3_destinations (
			id, name, endpoint, region, bucket_name, access_key_id,
			secret_access_key_enc, use_path_style, is_default, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, name, endpoint, region, bucketName, accessKeyID, secretAccessKeyEnc, usePathStyle, isDefault, now, now)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to save S3 destination: "+err.Error())
		return
	}

	if err := tx.Commit(); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to commit transaction: "+err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, models.S3Destination{
		ID:           id,
		Name:         name,
		Endpoint:     endpoint,
		Region:       region,
		BucketName:   bucketName,
		AccessKeyID:  accessKeyID,
		UsePathStyle: usePathStyle,
		IsDefault:    isDefault,
		CreatedAt:    now,
		UpdatedAt:    now,
	})
}

// UpdateS3Destination updates an existing S3 storage destination.
func (h *Handler) UpdateS3Destination(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		sendError(w, http.StatusInternalServerError, "Database not available")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		sendError(w, http.StatusBadRequest, "Destination ID is required")
		return
	}

	var req models.UpdateS3DestinationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Transaction error: "+err.Error())
		return
	}
	defer tx.Rollback()

	var dest models.S3Destination
	var secretEnc []byte
	var usePathStyle, isDefault bool
	err = tx.QueryRowContext(r.Context(), `
		SELECT id, name, endpoint, region, bucket_name, access_key_id,
		       secret_access_key_enc, use_path_style, is_default, created_at, updated_at
		FROM s3_destinations
		WHERE id = ?
	`, id).Scan(
		&dest.ID,
		&dest.Name,
		&dest.Endpoint,
		&dest.Region,
		&dest.BucketName,
		&dest.AccessKeyID,
		&secretEnc,
		&usePathStyle,
		&isDefault,
		&dest.CreatedAt,
		&dest.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		sendError(w, http.StatusNotFound, "S3 destination not found")
		return
	} else if err != nil {
		sendError(w, http.StatusInternalServerError, "Database query error: "+err.Error())
		return
	}
	dest.UsePathStyle = usePathStyle
	dest.IsDefault = isDefault

	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		dest.Name = strings.TrimSpace(*req.Name)
	}
	if req.Endpoint != nil && strings.TrimSpace(*req.Endpoint) != "" {
		dest.Endpoint = strings.TrimSpace(*req.Endpoint)
	}
	if req.Region != nil && strings.TrimSpace(*req.Region) != "" {
		dest.Region = strings.TrimSpace(*req.Region)
	}
	if req.BucketName != nil && strings.TrimSpace(*req.BucketName) != "" {
		dest.BucketName = strings.TrimSpace(*req.BucketName)
	}
	if req.AccessKeyID != nil && strings.TrimSpace(*req.AccessKeyID) != "" {
		dest.AccessKeyID = strings.TrimSpace(*req.AccessKeyID)
	}
	if req.SecretAccessKey != nil && strings.TrimSpace(*req.SecretAccessKey) != "" {
		ciphertext, nonce, err := crypto.Encrypt([]byte(strings.TrimSpace(*req.SecretAccessKey)), h.masterKey)
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to encrypt credentials: "+err.Error())
			return
		}
		secretEnc = append(nonce, ciphertext...)
	}
	if req.UsePathStyle != nil {
		dest.UsePathStyle = *req.UsePathStyle
	}

	if req.IsDefault != nil {
		dest.IsDefault = *req.IsDefault
		if dest.IsDefault {
			if _, err := tx.ExecContext(r.Context(), "UPDATE s3_destinations SET is_default = 0 WHERE id != ?", id); err != nil {
				sendError(w, http.StatusInternalServerError, "Failed to update default destinations: "+err.Error())
				return
			}
		}
	}

	dest.UpdatedAt = time.Now()

	_, err = tx.ExecContext(r.Context(), `
		UPDATE s3_destinations
		SET name = ?, endpoint = ?, region = ?, bucket_name = ?, access_key_id = ?,
		    secret_access_key_enc = ?, use_path_style = ?, is_default = ?, updated_at = ?
		WHERE id = ?
	`, dest.Name, dest.Endpoint, dest.Region, dest.BucketName, dest.AccessKeyID, secretEnc, dest.UsePathStyle, dest.IsDefault, dest.UpdatedAt, id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to update S3 destination: "+err.Error())
		return
	}

	if err := tx.Commit(); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to commit transaction: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, dest)
}

// DeleteS3Destination removes an S3 storage destination, preventing deletion if currently bound to active backup schedules.
func (h *Handler) DeleteS3Destination(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		sendError(w, http.StatusInternalServerError, "Database not available")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		sendError(w, http.StatusBadRequest, "Destination ID is required")
		return
	}

	var activeCount int
	err := h.db.QueryRowContext(r.Context(), `
		SELECT count(*)
		FROM backup_configs
		WHERE s3_destination_id = ? AND enabled = 1
	`, id).Scan(&activeCount)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Database error: "+err.Error())
		return
	}

	if activeCount > 0 {
		sendError(w, http.StatusConflict, fmt.Sprintf("Cannot delete S3 destination because it is currently bound to %d active backup schedule(s)", activeCount))
		return
	}

	res, err := h.db.ExecContext(r.Context(), "DELETE FROM s3_destinations WHERE id = ?", id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to delete destination: "+err.Error())
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		sendError(w, http.StatusNotFound, "S3 destination not found")
		return
	}

	sendJSON(w, http.StatusOK, models.SuccessResponse{
		Success: true,
		Message: "S3 destination removed successfully",
	})
}

// TestS3Destination executes an immediate connection test against a configured S3 destination.
func (h *Handler) TestS3Destination(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		sendError(w, http.StatusInternalServerError, "Database not available")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		sendError(w, http.StatusBadRequest, "Destination ID is required")
		return
	}

	var endpoint, region, bucket, accessKey string
	var encSecret []byte
	var usePathStyle bool
	err := h.db.QueryRowContext(r.Context(), `
		SELECT endpoint, region, bucket_name, access_key_id, secret_access_key_enc, use_path_style
		FROM s3_destinations
		WHERE id = ?
	`, id).Scan(&endpoint, &region, &bucket, &accessKey, &encSecret, &usePathStyle)
	if errors.Is(err, sql.ErrNoRows) {
		sendError(w, http.StatusNotFound, "S3 destination not found")
		return
	} else if err != nil {
		sendError(w, http.StatusInternalServerError, "Database query error: "+err.Error())
		return
	}

	if len(encSecret) < 12 {
		sendError(w, http.StatusInternalServerError, "Corrupted secret credentials in database")
		return
	}

	nonce := encSecret[:12]
	ciphertext := encSecret[12:]
	plaintext, err := crypto.Decrypt(ciphertext, nonce, h.masterKey)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to decrypt secret credentials: "+err.Error())
		return
	}
	secret := string(plaintext)

	// Allow overriding fields from optional request body
	var req models.TestS3DestinationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
		if strings.TrimSpace(req.Endpoint) != "" {
			endpoint = strings.TrimSpace(req.Endpoint)
		}
		if strings.TrimSpace(req.Region) != "" {
			region = strings.TrimSpace(req.Region)
		}
		if strings.TrimSpace(req.BucketName) != "" {
			bucket = strings.TrimSpace(req.BucketName)
		}
		if strings.TrimSpace(req.AccessKeyID) != "" {
			accessKey = strings.TrimSpace(req.AccessKeyID)
		}
		if strings.TrimSpace(req.SecretAccessKey) != "" {
			secret = strings.TrimSpace(req.SecretAccessKey)
		}
		if req.UsePathStyle != nil {
			usePathStyle = *req.UsePathStyle
		}
	}

	s3Cfg := storage.S3Config{
		EndpointURL:  endpoint,
		Region:       region,
		Bucket:       bucket,
		AccessKey:    accessKey,
		SecretKey:    secret,
		UsePathStyle: usePathStyle,
	}

	s3Client, err := storage.NewS3Client(r.Context(), s3Cfg)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Failed to create S3 client: "+err.Error())
		return
	}

	if err := s3Client.TestConnection(r.Context()); err != nil {
		sendError(w, http.StatusBadGateway, "S3 connection failed: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, models.SuccessResponse{
		Success: true,
		Message: "S3 destination connection verified successfully",
	})
}

// TestS3DestinationRaw executes an immediate test connection using credentials provided in request body.
func (h *Handler) TestS3DestinationRaw(w http.ResponseWriter, r *http.Request) {
	var req models.TestS3DestinationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	bucket := strings.TrimSpace(req.BucketName)
	accessKey := strings.TrimSpace(req.AccessKeyID)
	secret := strings.TrimSpace(req.SecretAccessKey)

	if bucket == "" {
		sendError(w, http.StatusBadRequest, "bucket_name is required")
		return
	}
	if accessKey == "" {
		sendError(w, http.StatusBadRequest, "access_key_id is required")
		return
	}
	if secret == "" {
		sendError(w, http.StatusBadRequest, "secret_access_key is required")
		return
	}

	region := "us-east-1"
	if strings.TrimSpace(req.Region) != "" {
		region = strings.TrimSpace(req.Region)
	}

	usePathStyle := false
	if req.UsePathStyle != nil {
		usePathStyle = *req.UsePathStyle
	}

	s3Cfg := storage.S3Config{
		EndpointURL:  strings.TrimSpace(req.Endpoint),
		Region:       region,
		Bucket:       bucket,
		AccessKey:    accessKey,
		SecretKey:    secret,
		UsePathStyle: usePathStyle,
	}

	s3Client, err := storage.NewS3Client(r.Context(), s3Cfg)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Failed to create S3 client: "+err.Error())
		return
	}

	if err := s3Client.TestConnection(r.Context()); err != nil {
		sendError(w, http.StatusBadGateway, "S3 connection failed: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, models.SuccessResponse{
		Success: true,
		Message: "S3 destination connection verified successfully",
	})
}
