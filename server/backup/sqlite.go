package backup

import (
	"compress/gzip"
	"context"
	"database/sql"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"

	"gettako.dev/tako/internal/models"
)

// StorageUploader is an interface satisfied by storage.S3Client or test mocks.
type StorageUploader interface {
	Upload(ctx context.Context, key string, body io.Reader, size int64, contentType string) error
	Delete(ctx context.Context, key string) error
}

// BackupSQLiteControlPlane performs an online zero-lock snapshot of SQLite using VACUUM INTO,
// gzips the snapshot, uploads it to S3, updates the database, and enforces the retention policy.
func BackupSQLiteControlPlane(
	ctx context.Context,
	db *sql.DB,
	uploader StorageUploader,
	retentionCount int,
) (*models.BackupRecord, error) {
	recordID := uuid.New().String()
	timestamp := time.Now().UTC()
	timeStr := timestamp.Format("20060102-150405")
	fileName := fmt.Sprintf("tako-control-plane-%s-%s.db.gz", timeStr, recordID[:8])
	s3Key := fmt.Sprintf("backups/control-plane/%s", fileName)

	// Insert pending backup record
	_, err := db.ExecContext(ctx, `
		INSERT INTO backup_records (
			id, service_id, server_id, backup_type, database_engine,
			status, file_name, s3_key, file_size_bytes, created_at
		) VALUES (?, NULL, NULL, 'control_plane', 'sqlite', 'running', ?, ?, 0, ?)
	`, recordID, fileName, s3Key, timestamp)
	if err != nil {
		return nil, fmt.Errorf("failed to insert initial backup record: %w", err)
	}

	markFailed := func(errMsg string) {
		_, _ = db.ExecContext(ctx, `
			UPDATE backup_records SET
				status = 'failed',
				error_message = ?,
				completed_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, errMsg, recordID)
	}

	// 1. Create a temporary file for VACUUM INTO
	tmpDir, err := os.MkdirTemp("", "tako-backup-*")
	if err != nil {
		markFailed(err.Error())
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	rawSnapshotPath := filepath.Join(tmpDir, "snapshot.db")
	gzSnapshotPath := filepath.Join(tmpDir, fileName)

	// Execute VACUUM INTO (online SQLite snapshot without locking concurrent operations)
	// modernc.org/sqlite supports VACUUM INTO 'path'
	vacuumQuery := fmt.Sprintf("VACUUM INTO '%s';", rawSnapshotPath)
	if _, err := db.ExecContext(ctx, vacuumQuery); err != nil {
		markFailed(fmt.Sprintf("VACUUM INTO failed: %v", err))
		return nil, fmt.Errorf("VACUUM INTO failed: %w", err)
	}

	// 2. Compress the snapshot with gzip
	rawFile, err := os.Open(rawSnapshotPath)
	if err != nil {
		markFailed(err.Error())
		return nil, fmt.Errorf("failed to open raw snapshot: %w", err)
	}
	defer rawFile.Close()

	gzFile, err := os.Create(gzSnapshotPath)
	if err != nil {
		markFailed(err.Error())
		return nil, fmt.Errorf("failed to create gzip file: %w", err)
	}

	gzWriter := gzip.NewWriter(gzFile)
	if _, err := io.Copy(gzWriter, rawFile); err != nil {
		gzWriter.Close()
		gzFile.Close()
		markFailed(err.Error())
		return nil, fmt.Errorf("failed to gzip snapshot: %w", err)
	}
	if err := gzWriter.Close(); err != nil {
		gzFile.Close()
		markFailed(err.Error())
		return nil, fmt.Errorf("failed to close gzip writer: %w", err)
	}
	if err := gzFile.Close(); err != nil {
		markFailed(err.Error())
		return nil, fmt.Errorf("failed to close gzip file: %w", err)
	}

	gzInfo, err := os.Stat(gzSnapshotPath)
	if err != nil {
		markFailed(err.Error())
		return nil, fmt.Errorf("failed to stat gzip snapshot: %w", err)
	}
	fileSizeBytes := gzInfo.Size()

	// 3. Upload to S3
	uploadReader, err := os.Open(gzSnapshotPath)
	if err != nil {
		markFailed(err.Error())
		return nil, fmt.Errorf("failed to open gzip snapshot for upload: %w", err)
	}
	defer uploadReader.Close()

	if uploader != nil {
		if err := uploader.Upload(ctx, s3Key, uploadReader, fileSizeBytes, "application/gzip"); err != nil {
			markFailed(fmt.Sprintf("upload to S3 failed: %v", err))
			return nil, fmt.Errorf("upload to S3 failed: %w", err)
		}
	}

	// 4. Mark completed in DB
	now := time.Now().UTC()
	_, err = db.ExecContext(ctx, `
		UPDATE backup_records SET
			status = 'completed',
			file_size_bytes = ?,
			completed_at = ?
		WHERE id = ?
	`, fileSizeBytes, now, recordID)
	if err != nil {
		return nil, fmt.Errorf("failed to update backup record completion: %w", err)
	}

	record := &models.BackupRecord{
		ID:            recordID,
		BackupType:    models.BackupTypeControlPlane,
		Status:        models.BackupStatusCompleted,
		FileName:      fileName,
		S3Key:         s3Key,
		FileSizeBytes: fileSizeBytes,
		CreatedAt:     timestamp,
		CompletedAt:   &now,
	}

	// 5. Clean up expired backups per retention policy
	if retentionCount > 0 && uploader != nil {
		if err := EnforceControlPlaneRetention(ctx, db, uploader, retentionCount); err != nil {
			slog.Warn("retention policy cleanup failed", slog.String("error", err.Error()))
		}
	}

	return record, nil
}

// EnforceControlPlaneRetention deletes older control plane backups exceeding the retention count.
func EnforceControlPlaneRetention(
	ctx context.Context,
	db *sql.DB,
	uploader StorageUploader,
	retentionCount int,
) error {
	rows, err := db.QueryContext(ctx, `
		SELECT id, s3_key
		FROM backup_records
		WHERE backup_type = 'control_plane' AND status = 'completed'
		ORDER BY created_at DESC
	`)
	if err != nil {
		return fmt.Errorf("query backup records for retention: %w", err)
	}
	defer rows.Close()

	type item struct {
		id    string
		s3Key string
	}
	var allBackups []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.id, &it.s3Key); err != nil {
			return err
		}
		allBackups = append(allBackups, it)
	}

	if len(allBackups) <= retentionCount {
		return nil
	}

	expired := allBackups[retentionCount:]
	for _, exp := range expired {
		if uploader != nil {
			_ = uploader.Delete(ctx, exp.s3Key)
		}
		_, _ = db.ExecContext(ctx, "DELETE FROM backup_records WHERE id = ?", exp.id)
		slog.Info("pruned expired control plane backup", slog.String("id", exp.id), slog.String("s3_key", exp.s3Key))
	}

	return nil
}
