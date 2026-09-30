package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/storage"
	"gettako.dev/tako/server/backup"
)

func (h *Handler) ensureBackupManager() *backup.ServiceBackupManager {
	if h.backupManager == nil {
		var sender backup.NodeTaskSender
		if h.nodeManager != nil {
			sender = h.nodeManager
		}
		h.backupManager = backup.NewServiceBackupManager(h.db, h.masterKey, sender)
	}
	return h.backupManager
}

// GetBackupConfig returns the global S3 backup configuration.
func (h *Handler) GetBackupConfig(w http.ResponseWriter, r *http.Request) {
	bm := h.ensureBackupManager()
	cfg, err := bm.GetGlobalConfig(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, "failed to get backup config: "+err.Error())
		return
	}
	sendJSON(w, http.StatusOK, cfg)
}

// UpdateBackupConfig updates the global S3 backup settings.
func (h *Handler) UpdateBackupConfig(w http.ResponseWriter, r *http.Request) {
	var req models.UpdateBackupConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	bm := h.ensureBackupManager()
	cfg, err := bm.SaveGlobalConfig(r.Context(), req)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "failed to save backup config: "+err.Error())
		return
	}
	sendJSON(w, http.StatusOK, cfg)
}

// TestBackupStorage tests connectivity to the target S3 bucket.
func (h *Handler) TestBackupStorage(w http.ResponseWriter, r *http.Request) {
	var req models.TestS3ConfigRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	bm := h.ensureBackupManager()
	cfg, secretKey, err := bm.GetGlobalConfigWithDecryptedSecret(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Override with body params if provided
	endpoint := cfg.EndpointURL
	if req.EndpointURL != "" {
		endpoint = req.EndpointURL
	}
	bucket := cfg.Bucket
	if req.Bucket != "" {
		bucket = req.Bucket
	}
	region := cfg.Region
	if req.Region != "" {
		region = req.Region
	}
	accessKey := cfg.AccessKey
	if req.AccessKey != "" {
		accessKey = req.AccessKey
	}
	if req.SecretKey != "" {
		secretKey = req.SecretKey
	}

	if bucket == "" || accessKey == "" || secretKey == "" {
		sendError(w, http.StatusBadRequest, "bucket, access_key, and secret_key are required to test connection")
		return
	}

	s3Client, err := storage.NewS3Client(r.Context(), storage.S3Config{
		EndpointURL: endpoint,
		Bucket:      bucket,
		Region:      region,
		AccessKey:   accessKey,
		SecretKey:   secretKey,
	})
	if err != nil {
		sendError(w, http.StatusBadRequest, "failed to create S3 client: "+err.Error())
		return
	}

	if err := s3Client.TestConnection(r.Context()); err != nil {
		sendError(w, http.StatusBadGateway, "S3 connection failed: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, models.SuccessResponse{
		Success: true,
		Message: "S3 connection verified successfully.",
	})
}

// ListControlPlaneBackups lists all snapshots of the Tako control plane SQLite database.
func (h *Handler) ListControlPlaneBackups(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, backup_type, database_engine, status, file_name, s3_key, file_size_bytes,
		       error_message, created_at, completed_at
		FROM backup_records
		WHERE backup_type = 'control_plane'
		ORDER BY created_at DESC
	`)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "failed to query backups: "+err.Error())
		return
	}
	defer rows.Close()

	var records []models.BackupRecord
	for rows.Next() {
		var rec models.BackupRecord
		var bType, status string
		var dbEngine, errMsg sql.NullString
		var completedAt sql.NullTime

		if err := rows.Scan(&rec.ID, &bType, &dbEngine, &status, &rec.FileName, &rec.S3Key, &rec.FileSizeBytes,
			&errMsg, &rec.CreatedAt, &completedAt); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		rec.BackupType = models.BackupType(bType)
		rec.Status = models.BackupStatus(status)
		if dbEngine.Valid {
			rec.DatabaseEngine = &dbEngine.String
		}
		if errMsg.Valid {
			rec.ErrorMessage = &errMsg.String
		}
		if completedAt.Valid {
			rec.CompletedAt = &completedAt.Time
		}
		records = append(records, rec)
	}

	if records == nil {
		records = []models.BackupRecord{}
	}
	sendJSON(w, http.StatusOK, records)
}

// TriggerControlPlaneBackup creates an instant, non-locking SQLite database snapshot and uploads it to S3.
func (h *Handler) TriggerControlPlaneBackup(w http.ResponseWriter, r *http.Request) {
	bm := h.ensureBackupManager()
	cfg, secretKey, err := bm.GetGlobalConfigWithDecryptedSecret(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if cfg.Bucket == "" || cfg.AccessKey == "" || secretKey == "" {
		sendError(w, http.StatusBadRequest, "S3 backup storage is not configured. Please configure it in Settings -> Backups first.")
		return
	}

	s3Client, err := storage.NewS3Client(r.Context(), storage.S3Config{
		EndpointURL: cfg.EndpointURL,
		Bucket:      cfg.Bucket,
		Region:      cfg.Region,
		AccessKey:   cfg.AccessKey,
		SecretKey:   secretKey,
	})
	if err != nil {
		sendError(w, http.StatusInternalServerError, "failed to initialize S3 client: "+err.Error())
		return
	}

	record, err := backup.BackupSQLiteControlPlane(r.Context(), h.db, s3Client, cfg.RetentionCount)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "backup failed: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, record)
}

// DownloadControlPlaneBackup generates a temporary download URL for a control plane backup.
func (h *Handler) DownloadControlPlaneBackup(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var s3Key string
	err := h.db.QueryRowContext(r.Context(), `
		SELECT s3_key FROM backup_records WHERE id = ? AND backup_type = 'control_plane'
	`, id).Scan(&s3Key)
	if err == sql.ErrNoRows {
		sendError(w, http.StatusNotFound, "backup not found")
		return
	} else if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	bm := h.ensureBackupManager()
	cfg, secretKey, err := bm.GetGlobalConfigWithDecryptedSecret(r.Context())
	if err != nil || cfg.Bucket == "" || secretKey == "" {
		sendError(w, http.StatusBadRequest, "S3 backup storage not configured")
		return
	}

	s3Client, err := storage.NewS3Client(r.Context(), storage.S3Config{
		EndpointURL: cfg.EndpointURL,
		Bucket:      cfg.Bucket,
		Region:      cfg.Region,
		AccessKey:   cfg.AccessKey,
		SecretKey:   secretKey,
	})
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	downloadURL, err := s3Client.GetPresignedURL(r.Context(), s3Key, 15*time.Minute)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "failed to generate download URL: "+err.Error())
		return
	}

	if r.URL.Query().Get("redirect") == "true" {
		http.Redirect(w, r, downloadURL, http.StatusFound)
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{
		"download_url": downloadURL,
	})
}

// DeleteControlPlaneBackup deletes a backup from S3 and the database.
func (h *Handler) DeleteControlPlaneBackup(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var s3Key string
	err := h.db.QueryRowContext(r.Context(), `
		SELECT s3_key FROM backup_records WHERE id = ? AND backup_type = 'control_plane'
	`, id).Scan(&s3Key)
	if err == sql.ErrNoRows {
		sendError(w, http.StatusNotFound, "backup not found")
		return
	} else if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	bm := h.ensureBackupManager()
	cfg, secretKey, _ := bm.GetGlobalConfigWithDecryptedSecret(r.Context())
	if cfg != nil && cfg.Bucket != "" && secretKey != "" {
		s3Client, err := storage.NewS3Client(r.Context(), storage.S3Config{
			EndpointURL: cfg.EndpointURL,
			Bucket:      cfg.Bucket,
			Region:      cfg.Region,
			AccessKey:   cfg.AccessKey,
			SecretKey:   secretKey,
		})
		if err == nil {
			_ = s3Client.Delete(r.Context(), s3Key)
		}
	}

	_, _ = h.db.ExecContext(r.Context(), "DELETE FROM backup_records WHERE id = ?", id)
	sendJSON(w, http.StatusOK, models.SuccessResponse{
		Success: true,
		Message: "Backup deleted successfully.",
	})
}

// ListServiceBackups lists historical backups for a database or persistent service.
func (h *Handler) ListServiceBackups(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT br.id, br.service_id, br.server_id, br.backup_type, br.database_engine, br.status,
		       br.file_name, br.s3_key, br.file_size_bytes, br.s3_destination_id, sd.name,
		       br.error_message, br.created_at, br.completed_at
		FROM backup_records br
		LEFT JOIN s3_destinations sd ON sd.id = br.s3_destination_id
		WHERE br.service_id = ?
		ORDER BY br.created_at DESC
	`, serviceID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "failed to query service backups: "+err.Error())
		return
	}
	defer rows.Close()

	var records []models.BackupRecord
	for rows.Next() {
		var rec models.BackupRecord
		var sID, srvID, dbEngine, errMsg, destID, destName sql.NullString
		var bType, status string
		var completedAt sql.NullTime

		if err := rows.Scan(&rec.ID, &sID, &srvID, &bType, &dbEngine, &status,
			&rec.FileName, &rec.S3Key, &rec.FileSizeBytes, &destID, &destName,
			&errMsg, &rec.CreatedAt, &completedAt); err != nil {
			sendError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if sID.Valid {
			rec.ServiceID = &sID.String
		}
		if srvID.Valid {
			rec.ServerID = &srvID.String
		}
		rec.BackupType = models.BackupType(bType)
		rec.Status = models.BackupStatus(status)
		if dbEngine.Valid {
			rec.DatabaseEngine = &dbEngine.String
		}
		if destID.Valid {
			rec.S3DestinationID = &destID.String
		}
		if destName.Valid {
			rec.S3DestinationName = &destName.String
		}
		if errMsg.Valid {
			rec.ErrorMessage = &errMsg.String
		}
		if completedAt.Valid {
			rec.CompletedAt = &completedAt.Time
		}
		records = append(records, rec)
	}

	if records == nil {
		records = []models.BackupRecord{}
	}
	sendJSON(w, http.StatusOK, records)
}

// TriggerServiceBackup triggers an on-demand database dump or volume backup.
func (h *Handler) TriggerServiceBackup(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	var req models.TriggerBackupRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	bm := h.ensureBackupManager()
	rec, err := bm.TriggerServiceBackup(r.Context(), serviceID, req)
	if err != nil {
		sendError(w, http.StatusBadRequest, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, rec)
}

// DownloadServiceBackup generates a presigned URL to download a service backup archive.
func (h *Handler) DownloadServiceBackup(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	backupID := chi.URLParam(r, "backup_id")

	var s3Key string
	var destID sql.NullString
	err := h.db.QueryRowContext(r.Context(), `
		SELECT s3_key, s3_destination_id FROM backup_records WHERE id = ? AND service_id = ?
	`, backupID, serviceID).Scan(&s3Key, &destID)
	if err == sql.ErrNoRows {
		sendError(w, http.StatusNotFound, "backup not found")
		return
	} else if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	bm := h.ensureBackupManager()
	var destPtr *string
	if destID.Valid && destID.String != "" {
		destPtr = &destID.String
	}
	dest, err := bm.ResolveS3Destination(r.Context(), destPtr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "S3 backup storage not configured: "+err.Error())
		return
	}

	s3Client, err := storage.NewS3Client(r.Context(), storage.S3Config{
		EndpointURL:  dest.EndpointURL,
		Bucket:       dest.Bucket,
		Region:       dest.Region,
		AccessKey:    dest.AccessKey,
		SecretKey:    dest.SecretKey,
		UsePathStyle: dest.UsePathStyle,
	})
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	downloadURL, err := s3Client.GetPresignedURL(r.Context(), s3Key, 15*time.Minute)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "failed to generate download URL: "+err.Error())
		return
	}

	if r.URL.Query().Get("redirect") == "true" {
		http.Redirect(w, r, downloadURL, http.StatusFound)
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{
		"download_url": downloadURL,
	})
}

// RestoreServiceBackup restores a previous backup dump into the container.
func (h *Handler) RestoreServiceBackup(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	backupID := chi.URLParam(r, "backup_id")

	bm := h.ensureBackupManager()
	res, err := bm.RestoreServiceBackup(r.Context(), serviceID, backupID)
	if err != nil {
		sendError(w, http.StatusBadRequest, "restore failed: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, res)
}

// DeleteServiceBackup removes the backup from S3 and the database.
func (h *Handler) DeleteServiceBackup(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	backupID := chi.URLParam(r, "backup_id")

	var s3Key string
	var destID sql.NullString
	err := h.db.QueryRowContext(r.Context(), `
		SELECT s3_key, s3_destination_id FROM backup_records WHERE id = ? AND service_id = ?
	`, backupID, serviceID).Scan(&s3Key, &destID)
	if err == sql.ErrNoRows {
		sendError(w, http.StatusNotFound, "backup not found")
		return
	} else if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	bm := h.ensureBackupManager()
	var destPtr *string
	if destID.Valid && destID.String != "" {
		destPtr = &destID.String
	}
	if dest, err := bm.ResolveS3Destination(r.Context(), destPtr); err == nil {
		s3Client, err := storage.NewS3Client(r.Context(), storage.S3Config{
			EndpointURL:  dest.EndpointURL,
			Bucket:       dest.Bucket,
			Region:       dest.Region,
			AccessKey:    dest.AccessKey,
			SecretKey:    dest.SecretKey,
			UsePathStyle: dest.UsePathStyle,
		})
		if err == nil {
			_ = s3Client.Delete(r.Context(), s3Key)
		}
	}

	_, _ = h.db.ExecContext(r.Context(), "DELETE FROM backup_records WHERE id = ? AND service_id = ?", backupID, serviceID)
	sendJSON(w, http.StatusOK, models.SuccessResponse{
		Success: true,
		Message: "Backup deleted successfully.",
	})
}

// GetServiceBackupSchedule returns automated backup schedule configuration for a service.
func (h *Handler) GetServiceBackupSchedule(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	bm := h.ensureBackupManager()
	sched, err := bm.GetServiceSchedule(r.Context(), serviceID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "failed to get backup schedule: "+err.Error())
		return
	}
	sendJSON(w, http.StatusOK, sched)
}

// UpdateServiceBackupSchedule updates automated backup schedule and target destination.
func (h *Handler) UpdateServiceBackupSchedule(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	var req models.UpdateBackupScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	bm := h.ensureBackupManager()
	sched, err := bm.UpdateServiceSchedule(r.Context(), serviceID, req)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "failed to update backup schedule: "+err.Error())
		return
	}
	sendJSON(w, http.StatusOK, sched)
}
