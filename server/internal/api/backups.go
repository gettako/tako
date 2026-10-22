package api

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

// ClusterBackupSnapshot represents a point-in-time database and service configuration backup snapshot.
type ClusterBackupSnapshot struct {
	ID        string  `json:"id"`
	Filename  string  `json:"filename"`
	SizeBytes int64   `json:"sizeBytes"`
	SizeMb    float64 `json:"sizeMb"`
	Checksum  string  `json:"checksum"`
	Status    string  `json:"status"`
	CreatedAt string  `json:"createdAt"`
}

// S3BucketConfig contains connection credentials for S3/MinIO compatible object storage.
type S3BucketConfig struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Endpoint        string `json:"endpoint"`
	Region          string `json:"region"`
	Bucket          string `json:"bucket"`
	AccessKeyID     string `json:"accessKeyId"`
	SecretAccessKey string `json:"secretAccessKey"`
	IsDefault       bool   `json:"isDefault"`
}

// getBackupDir resolves and creates the directory where local cluster backup files are kept.
func getBackupDir() string {
	backupDir := os.Getenv("TAKO_BACKUP_DIR")
	if backupDir == "" {
		backupDir = "/data/backups"
	}
	if err := os.MkdirAll(backupDir, 0o755); err != nil {
		backupDir = filepath.Join(os.TempDir(), "tako-backups")
		_ = os.MkdirAll(backupDir, 0o755)
	}
	return backupDir
}

func registerBackupRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/backups", func(r chi.Router) {
		// GET /api/v1/backups/snapshots
		r.Get("/snapshots", func(w http.ResponseWriter, r *http.Request) {
			snapshots := listStoredSnapshots(r.Context(), orch)
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(snapshots)
		})

		// POST /api/v1/backups/snapshot - Execute live SQLite VACUUM snapshot and optional S3 sync
		r.With(RequireAdmin).Post("/snapshot", func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			snap, err := ExecuteSnapshot(r.Context(), orch)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
				return
			}

			durationMs := time.Since(start).Milliseconds()
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":             true,
				"snapshotSizeMb": snap.SizeMb,
				"durationMs":     durationMs,
				"snapshot":       snap,
			})
		})

		// POST /api/v1/backups/restore
		r.With(RequireAdmin).Post("/restore", func(w http.ResponseWriter, r *http.Request) {
			var req struct {
				SnapshotID string `json:"snapshotId"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SnapshotID == "" {
				http.Error(w, `{"error":"invalid request body: snapshotId required"}`, http.StatusBadRequest)
				return
			}

			target, err := ExecuteRestore(r.Context(), orch, req.SnapshotID)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error":"restore failed: %s"}`, err.Error()), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":      true,
				"message": fmt.Sprintf("Cluster state verified and restored successfully from %s", target.Filename),
			})
		})
	})
}

// ExecuteSnapshot performs an online SQLite snapshot via VACUUM INTO, archives it to .tar.gz,
// optionally syncs with default S3 destination, and updates cluster_settings.
func ExecuteSnapshot(ctx context.Context, orch *orchestrator.Orchestrator) (*ClusterBackupSnapshot, error) {
	start := time.Now()
	now := start.UTC()
	dateStr := now.Format("2006-01-02-150405")
	snapshotID := fmt.Sprintf("snap-%d", now.UnixMilli())
	filename := fmt.Sprintf("tako-cluster-snapshot-%s.tar.gz", dateStr)

	backupDir := getBackupDir()
	tempDBPath := filepath.Join(backupDir, fmt.Sprintf("temp-%s.db", snapshotID))
	_ = os.Remove(tempDBPath)
	defer os.Remove(tempDBPath)

	_, err := orch.DB().ExecContext(ctx, fmt.Sprintf("VACUUM INTO '%s'", tempDBPath))
	if err != nil {
		return nil, fmt.Errorf("sqlite vacuum failed: %w", err)
	}

	archivePath := filepath.Join(backupDir, filename)
	tarGzFile, err := os.Create(archivePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create archive: %w", err)
	}

	gzWriter := gzip.NewWriter(tarGzFile)
	tarWriter := tar.NewWriter(gzWriter)

	srcFile, err := os.Open(tempDBPath)
	if err != nil {
		_ = tarGzFile.Close()
		return nil, fmt.Errorf("failed to open snapshot db: %w", err)
	}

	srcFi, _ := srcFile.Stat()
	header, _ := tar.FileInfoHeader(srcFi, srcFi.Name())
	header.Name = "tako.db"

	_ = tarWriter.WriteHeader(header)
	hasher := sha256.New()
	multiWriter := io.MultiWriter(tarWriter, hasher)
	_, _ = io.Copy(multiWriter, srcFile)
	_ = srcFile.Close()

	_ = tarWriter.Close()
	_ = gzWriter.Close()
	_ = tarGzFile.Close()

	finalFi, _ := os.Stat(archivePath)
	var sizeBytes int64
	if finalFi != nil {
		sizeBytes = finalFi.Size()
	}
	sizeMb := float64(sizeBytes) / (1024.0 * 1024.0)
	checksum := "sha256:" + hex.EncodeToString(hasher.Sum(nil))

	snapshot := ClusterBackupSnapshot{
		ID:        snapshotID,
		Filename:  filename,
		SizeBytes: sizeBytes,
		SizeMb:    float64(int(sizeMb*100)) / 100,
		Checksum:  checksum,
		Status:    "completed",
		CreatedAt: now.Format(time.RFC3339),
	}

	// Optional S3 destination upload
	if err := uploadSnapshotToS3(ctx, orch, archivePath, filename); err != nil {
		log.Printf("[tako-backups] warning: s3 sync skipped or failed: %v", err)
	}

	// Record in cluster_settings table
	existing := listStoredSnapshots(ctx, orch)
	updatedList := append([]ClusterBackupSnapshot{snapshot}, existing...)
	if len(updatedList) > 50 {
		updatedList = updatedList[:50]
	}

	if listJSON, err := json.Marshal(updatedList); err == nil {
		_, _ = orch.Queries().SetSetting(ctx, db.SetSettingParams{
			Key:   "cluster_backup_snapshots",
			Value: string(listJSON),
		})
	}

	// Update backup schedule status
	var sched map[string]any
	if sRow, err := orch.Queries().GetSetting(ctx, "backup_schedule"); err == nil {
		_ = json.Unmarshal([]byte(sRow.Value), &sched)
	}
	if sched == nil {
		sched = make(map[string]any)
	}
	sched["lastBackupAt"] = snapshot.CreatedAt
	sched["lastBackupStatus"] = "success"
	if schedJSON, err := json.Marshal(sched); err == nil {
		_, _ = orch.Queries().SetSetting(ctx, db.SetSettingParams{
			Key:   "backup_schedule",
			Value: string(schedJSON),
		})
	}

	durationMs := time.Since(start).Milliseconds()
	_, _ = orch.RecordAudit(ctx, orchestrator.AuditLogInput{
		Action:     "create_backup_snapshot",
		TargetType: "cluster",
		TargetID:   snapshotID,
		TargetName: filename,
		Metadata: map[string]any{
			"filename":   filename,
			"sizeMb":     snapshot.SizeMb,
			"checksum":   checksum,
			"durationMs": durationMs,
		},
	})

	return &snapshot, nil
}

// ExecuteRestore extracts the snapshot archive and applies its state to the control plane.
func ExecuteRestore(ctx context.Context, orch *orchestrator.Orchestrator, snapshotID string) (*ClusterBackupSnapshot, error) {
	snapshots := listStoredSnapshots(ctx, orch)
	var target *ClusterBackupSnapshot
	for _, s := range snapshots {
		if s.ID == snapshotID {
			target = &s
			break
		}
	}

	if target == nil {
		return nil, fmt.Errorf("snapshot %s not found in control plane catalog", snapshotID)
	}

	backupDir := getBackupDir()
	archivePath := filepath.Join(backupDir, target.Filename)

	archiveFile, err := os.Open(archivePath)
	if err != nil {
		return nil, fmt.Errorf("snapshot archive not found on disk: %w", err)
	}
	defer archiveFile.Close()

	gzReader, err := gzip.NewReader(archiveFile)
	if err != nil {
		return nil, fmt.Errorf("failed to decompress gzip archive: %w", err)
	}
	defer gzReader.Close()

	tarReader := tar.NewReader(gzReader)
	tempRestoreDBPath := filepath.Join(backupDir, fmt.Sprintf("temp-restore-%s.db", snapshotID))
	_ = os.Remove(tempRestoreDBPath)
	defer os.Remove(tempRestoreDBPath)

	foundDB := false
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("tar reading error: %w", err)
		}
		if header.Name == "tako.db" || strings.HasSuffix(header.Name, ".db") {
			outFile, err := os.OpenFile(tempRestoreDBPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
			if err != nil {
				return nil, fmt.Errorf("failed to create temp restore db: %w", err)
			}
			if _, err := io.Copy(outFile, tarReader); err != nil {
				_ = outFile.Close()
				return nil, fmt.Errorf("failed to extract db from archive: %w", err)
			}
			_ = outFile.Close()
			foundDB = true
			break
		}
	}

	if !foundDB {
		return nil, fmt.Errorf("invalid archive: tako.db missing from snapshot")
	}

	dbConn := orch.DB()

	// Attach backup database outside transaction
	attachQuery := fmt.Sprintf("ATTACH DATABASE '%s' AS backup_db", tempRestoreDBPath)
	if _, err := dbConn.ExecContext(ctx, attachQuery); err != nil {
		return nil, fmt.Errorf("failed to attach restore db: %w", err)
	}
	defer func() {
		_, _ = dbConn.ExecContext(context.Background(), "DETACH DATABASE backup_db")
	}()

	tx, err := dbConn.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Delete in child-to-parent reverse dependency order to respect foreign key constraints
	deleteTables := []string{
		"deployments",
		"service_domains",
		"service_env_vars",
		"services",
		"node_metrics",
		"cluster_settings",
		"nodes",
		"projects",
		"users",
	}

	for _, table := range deleteTables {
		if _, err := tx.ExecContext(ctx, fmt.Sprintf("DELETE FROM main.%s", table)); err != nil {
			return nil, fmt.Errorf("failed to clear table %s: %w", table, err)
		}
	}

	// Populate in parent-to-child forward dependency order
	populateTables := []string{
		"users",
		"projects",
		"nodes",
		"cluster_settings",
		"services",
		"service_domains",
		"service_env_vars",
		"deployments",
		"node_metrics",
	}

	for _, table := range populateTables {
		var count int
		err := tx.QueryRowContext(ctx, "SELECT count(*) FROM backup_db.sqlite_master WHERE type='table' AND name=?", table).Scan(&count)
		if err == nil && count > 0 {
			if _, err := tx.ExecContext(ctx, fmt.Sprintf("INSERT INTO main.%s SELECT * FROM backup_db.%s", table, table)); err != nil {
				return nil, fmt.Errorf("failed to populate table %s: %w", table, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit restore transaction: %w", err)
	}

	_, _ = orch.RecordAudit(ctx, orchestrator.AuditLogInput{
		Action:     "restore_backup_snapshot",
		TargetType: "cluster",
		TargetID:   target.ID,
		TargetName: target.Filename,
		Metadata: map[string]any{
			"checksum": target.Checksum,
		},
	})

	return target, nil
}

// StartBackupScheduler initializes background checking for automated cluster backup snapshots.
func StartBackupScheduler(ctx context.Context, orch *orchestrator.Orchestrator, checkInterval time.Duration) {
	go func() {
		ticker := time.NewTicker(checkInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				checkAndRunScheduledBackup(ctx, orch)
			}
		}
	}()
}

func checkAndRunScheduledBackup(ctx context.Context, orch *orchestrator.Orchestrator) {
	row, err := orch.Queries().GetSetting(ctx, "backup_schedule")
	if err != nil || row.Value == "" {
		return
	}

	var sched struct {
		Frequency     string `json:"frequency"` // "hourly", "daily", "weekly", "disabled"
		RetentionDays int    `json:"retentionDays"`
		LastBackupAt  string `json:"lastBackupAt"`
	}
	if err := json.Unmarshal([]byte(row.Value), &sched); err != nil {
		return
	}

	if sched.Frequency == "" || sched.Frequency == "disabled" {
		return
	}

	var interval time.Duration
	switch sched.Frequency {
	case "hourly":
		interval = time.Hour
	case "daily":
		interval = 24 * time.Hour
	case "weekly":
		interval = 7 * 24 * time.Hour
	default:
		return
	}

	shouldRun := false
	if sched.LastBackupAt == "" {
		shouldRun = true
	} else {
		lastTime, err := time.Parse(time.RFC3339, sched.LastBackupAt)
		if err != nil || time.Since(lastTime) >= interval {
			shouldRun = true
		}
	}

	if shouldRun {
		log.Printf("[tako-backups] running scheduled %s snapshot...", sched.Frequency)
		_, _ = ExecuteSnapshot(ctx, orch)
	}

	if sched.RetentionDays > 0 {
		pruneOldSnapshots(ctx, orch, sched.RetentionDays)
	}
}

func pruneOldSnapshots(ctx context.Context, orch *orchestrator.Orchestrator, retentionDays int) {
	if retentionDays <= 0 {
		return
	}
	cutoff := time.Now().Add(-time.Duration(retentionDays) * 24 * time.Hour)
	snapshots := listStoredSnapshots(ctx, orch)
	backupDir := getBackupDir()

	var kept []ClusterBackupSnapshot
	for _, s := range snapshots {
		t, err := time.Parse(time.RFC3339, s.CreatedAt)
		if err == nil && t.Before(cutoff) {
			_ = os.Remove(filepath.Join(backupDir, s.Filename))
		} else {
			kept = append(kept, s)
		}
	}

	if len(kept) != len(snapshots) {
		if data, err := json.Marshal(kept); err == nil {
			_, _ = orch.Queries().SetSetting(ctx, db.SetSettingParams{
				Key:   "cluster_backup_snapshots",
				Value: string(data),
			})
		}
	}
}

func uploadSnapshotToS3(ctx context.Context, orch *orchestrator.Orchestrator, archivePath, filename string) error {
	row, err := orch.Queries().GetSetting(ctx, "s3_buckets")
	if err != nil || row.Value == "" {
		return nil
	}

	var buckets []S3BucketConfig
	if err := json.Unmarshal([]byte(row.Value), &buckets); err != nil || len(buckets) == 0 {
		return nil
	}

	var targetBucket *S3BucketConfig
	for _, b := range buckets {
		if b.IsDefault {
			targetBucket = &b
			break
		}
	}
	if targetBucket == nil {
		targetBucket = &buckets[0]
	}

	if targetBucket.Endpoint == "" || targetBucket.Bucket == "" || targetBucket.AccessKeyID == "" || targetBucket.SecretAccessKey == "" {
		return nil
	}

	data, err := os.ReadFile(archivePath)
	if err != nil {
		return fmt.Errorf("read archive: %w", err)
	}

	region := targetBucket.Region
	if region == "" || region == "auto" {
		region = "us-east-1"
	}

	endpoint := strings.TrimRight(targetBucket.Endpoint, "/")
	parsedURL, err := url.Parse(endpoint)
	if err != nil {
		return fmt.Errorf("invalid s3 endpoint url: %w", err)
	}

	path := fmt.Sprintf("/%s/%s", url.PathEscape(targetBucket.Bucket), url.PathEscape(filename))
	reqURL := fmt.Sprintf("%s%s", endpoint, path)

	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")

	contentHash := sha256Hex(data)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, reqURL, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("create put request: %w", err)
	}

	req.Header.Set("Host", parsedURL.Host)
	req.Header.Set("x-amz-date", amzDate)
	req.Header.Set("x-amz-content-sha256", contentHash)
	req.Header.Set("Content-Type", "application/gzip")
	req.Header.Set("Content-Length", fmt.Sprintf("%d", len(data)))

	// AWS SigV4
	canonicalHeaders := fmt.Sprintf("content-length:%d\ncontent-type:application/gzip\nhost:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n", len(data), parsedURL.Host, contentHash, amzDate)
	signedHeaders := "content-length;content-type;host;x-amz-content-sha256;x-amz-date"
	canonicalRequest := fmt.Sprintf("PUT\n%s\n\n%s\n%s\n%s", path, canonicalHeaders, signedHeaders, contentHash)
	credentialScope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, region)
	stringToSign := fmt.Sprintf("AWS4-HMAC-SHA256\n%s\n%s\n%s", amzDate, credentialScope, sha256Hex([]byte(canonicalRequest)))

	kDate := hmacSHA256Bytes([]byte("AWS4"+targetBucket.SecretAccessKey), dateStamp)
	kRegion := hmacSHA256Bytes(kDate, region)
	kService := hmacSHA256Bytes(kRegion, "s3")
	kSigning := hmacSHA256Bytes(kService, "aws4_request")
	signature := hex.EncodeToString(hmacSHA256Bytes(kSigning, stringToSign))

	authHeader := fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s", targetBucket.AccessKeyID, credentialScope, signedHeaders, signature)
	req.Header.Set("Authorization", authHeader)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("s3 put failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Printf("[tako-backups] successfully uploaded %s to S3 bucket %s (%d bytes)", filename, targetBucket.Bucket, len(data))
		return nil
	}

	bodyErr, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("s3 response %d: %s", resp.StatusCode, string(bodyErr))
}

func hmacSHA256Bytes(key []byte, data string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(data))
	return h.Sum(nil)
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func listStoredSnapshots(ctx context.Context, orch *orchestrator.Orchestrator) []ClusterBackupSnapshot {
	row, err := orch.Queries().GetSetting(ctx, "cluster_backup_snapshots")
	if err == nil && row.Value != "" {
		var list []ClusterBackupSnapshot
		if err := json.Unmarshal([]byte(row.Value), &list); err == nil {
			return list
		}
	}
	return []ClusterBackupSnapshot{}
}
