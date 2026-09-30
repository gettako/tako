package backup

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/robfig/cron/v3"

	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
	"gettako.dev/tako/internal/storage"
)

type NodeTaskSender interface {
	SendTaskWithResponse(ctx context.Context, nodeID string, taskID string, msg *protocol.ServerMessage) (*protocol.TaskAck, error)
}

// ServiceBackupManager orchestrates both control plane and remote container backups.
type ServiceBackupManager struct {
	db          *sql.DB
	masterKey   []byte
	nodeSender  NodeTaskSender
	cronRunner  *cron.Cron
	entryIDs    map[string]cron.EntryID
	mu          sync.Mutex
}

func NewServiceBackupManager(db *sql.DB, masterKey []byte, nodeSender NodeTaskSender) *ServiceBackupManager {
	mgr := &ServiceBackupManager{
		db:         db,
		masterKey:  masterKey,
		nodeSender: nodeSender,
		cronRunner: cron.New(cron.WithParser(cron.NewParser(
			cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
		))),
		entryIDs: make(map[string]cron.EntryID),
	}
	return mgr
}

// StartScheduler starts the cron scheduler for automated backups.
func (m *ServiceBackupManager) StartScheduler(ctx context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Initial registration of global backup job
	m.reloadScheduleLocked(ctx)
	m.cronRunner.Start()
}

// StopScheduler stops the cron scheduler.
func (m *ServiceBackupManager) StopScheduler() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.cronRunner != nil {
		m.cronRunner.Stop()
	}
}

// ReloadSchedule re-registers scheduled cron jobs from database configurations.
func (m *ServiceBackupManager) ReloadSchedule(ctx context.Context) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.reloadScheduleLocked(ctx)
}

type ResolvedS3Destination struct {
	ID           string
	Name         string
	EndpointURL  string
	Region       string
	Bucket       string
	AccessKey    string
	SecretKey    string
	UsePathStyle bool
}

// ResolveS3Destination finds the target S3 destination, falling back to default if unselected.
func (m *ServiceBackupManager) ResolveS3Destination(ctx context.Context, requestedID *string) (*ResolvedS3Destination, error) {
	if requestedID != nil && strings.TrimSpace(*requestedID) != "" {
		destID := strings.TrimSpace(*requestedID)
		var dest ResolvedS3Destination
		var encSecret []byte
		var usePathStyle bool
		err := m.db.QueryRowContext(ctx, `
			SELECT id, name, endpoint, region, bucket_name, access_key_id, secret_access_key_enc, use_path_style
			FROM s3_destinations
			WHERE id = ?
		`, destID).Scan(&dest.ID, &dest.Name, &dest.EndpointURL, &dest.Region, &dest.Bucket, &dest.AccessKey, &encSecret, &usePathStyle)
		if err == nil {
			dest.UsePathStyle = usePathStyle
			if len(encSecret) >= 12 && len(m.masterKey) == 32 {
				nonce := encSecret[:12]
				ciphertext := encSecret[12:]
				plain, decErr := crypto.Decrypt(ciphertext, nonce, m.masterKey)
				if decErr == nil {
					dest.SecretKey = string(plain)
					return &dest, nil
				}
			}
			return nil, fmt.Errorf("failed to decrypt credentials for S3 destination: %s", destID)
		}
		if err != sql.ErrNoRows {
			return nil, fmt.Errorf("failed to query S3 destination %s: %w", destID, err)
		}
		return nil, fmt.Errorf("s3 destination not found: %s", destID)
	}

	// Try default destination
	var dest ResolvedS3Destination
	var encSecret []byte
	var usePathStyle bool
	err := m.db.QueryRowContext(ctx, `
		SELECT id, name, endpoint, region, bucket_name, access_key_id, secret_access_key_enc, use_path_style
		FROM s3_destinations
		WHERE is_default = 1
		LIMIT 1
	`).Scan(&dest.ID, &dest.Name, &dest.EndpointURL, &dest.Region, &dest.Bucket, &dest.AccessKey, &encSecret, &usePathStyle)
	if err == nil {
		dest.UsePathStyle = usePathStyle
		if len(encSecret) >= 12 && len(m.masterKey) == 32 {
			nonce := encSecret[:12]
			ciphertext := encSecret[12:]
			plain, decErr := crypto.Decrypt(ciphertext, nonce, m.masterKey)
			if decErr == nil {
				dest.SecretKey = string(plain)
				return &dest, nil
			}
		}
	}

	// Try earliest destination if no default is explicitly flagged
	err = m.db.QueryRowContext(ctx, `
		SELECT id, name, endpoint, region, bucket_name, access_key_id, secret_access_key_enc, use_path_style
		FROM s3_destinations
		ORDER BY created_at ASC
		LIMIT 1
	`).Scan(&dest.ID, &dest.Name, &dest.EndpointURL, &dest.Region, &dest.Bucket, &dest.AccessKey, &encSecret, &usePathStyle)
	if err == nil {
		dest.UsePathStyle = usePathStyle
		if len(encSecret) >= 12 && len(m.masterKey) == 32 {
			nonce := encSecret[:12]
			ciphertext := encSecret[12:]
			plain, decErr := crypto.Decrypt(ciphertext, nonce, m.masterKey)
			if decErr == nil {
				dest.SecretKey = string(plain)
				return &dest, nil
			}
		}
	}

	// Fallback to legacy global config
	legacyCfg, secretKey, err := m.GetGlobalConfigWithDecryptedSecret(ctx)
	if err == nil && legacyCfg != nil && legacyCfg.Bucket != "" && secretKey != "" {
		return &ResolvedS3Destination{
			ID:          "",
			Name:        "Default Storage",
			EndpointURL: legacyCfg.EndpointURL,
			Region:      legacyCfg.Region,
			Bucket:      legacyCfg.Bucket,
			AccessKey:   legacyCfg.AccessKey,
			SecretKey:   secretKey,
		}, nil
	}

	return nil, fmt.Errorf("no S3 destination is configured. Please configure an S3 destination in Settings -> Storage first")
}

// GetServiceSchedule loads the backup schedule for a service.
func (m *ServiceBackupManager) GetServiceSchedule(ctx context.Context, serviceID string) (*models.ServiceBackupSchedule, error) {
	row := m.db.QueryRowContext(ctx, `
		SELECT bc.id, bc.service_id, bc.enabled, bc.s3_destination_id, sd.name,
		       bc.cron_expression, bc.retention_count, bc.created_at, bc.updated_at
		FROM backup_configs bc
		LEFT JOIN s3_destinations sd ON sd.id = bc.s3_destination_id
		WHERE bc.service_id = ?
	`, serviceID)

	var sched models.ServiceBackupSchedule
	var destID, destName sql.NullString
	err := row.Scan(&sched.ID, &sched.ServiceID, &sched.Enabled, &destID, &destName,
		&sched.CronExpression, &sched.RetentionCount, &sched.CreatedAt, &sched.UpdatedAt)
	if err == sql.ErrNoRows {
		now := time.Now().UTC()
		var defaultDestID, defaultDestName sql.NullString
		_ = m.db.QueryRowContext(ctx, "SELECT id, name FROM s3_destinations WHERE is_default = 1 LIMIT 1").Scan(&defaultDestID, &defaultDestName)
		var dID, dName *string
		if defaultDestID.Valid {
			dID = &defaultDestID.String
		}
		if defaultDestName.Valid {
			dName = &defaultDestName.String
		}

		return &models.ServiceBackupSchedule{
			ID:                "sched-" + serviceID,
			ServiceID:         serviceID,
			Enabled:           false,
			S3DestinationID:   dID,
			S3DestinationName: dName,
			CronExpression:    "0 2 * * *",
			RetentionCount:    7,
			CreatedAt:         now,
			UpdatedAt:         now,
		}, nil
	} else if err != nil {
		return nil, fmt.Errorf("failed to get service backup schedule: %w", err)
	}

	if destID.Valid {
		sched.S3DestinationID = &destID.String
	}
	if destName.Valid {
		sched.S3DestinationName = &destName.String
	}
	return &sched, nil
}

// UpdateServiceSchedule updates or creates a service automated backup schedule.
func (m *ServiceBackupManager) UpdateServiceSchedule(ctx context.Context, serviceID string, req models.UpdateBackupScheduleRequest) (*models.ServiceBackupSchedule, error) {
	current, err := m.GetServiceSchedule(ctx, serviceID)
	if err != nil {
		return nil, err
	}

	enabled := current.Enabled
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	s3DestID := current.S3DestinationID
	if req.S3DestinationID != nil {
		if strings.TrimSpace(*req.S3DestinationID) == "" {
			s3DestID = nil
		} else {
			trimmed := strings.TrimSpace(*req.S3DestinationID)
			s3DestID = &trimmed
		}
	}

	cronExpr := current.CronExpression
	if req.CronExpression != nil && strings.TrimSpace(*req.CronExpression) != "" {
		cronExpr = strings.TrimSpace(*req.CronExpression)
	}

	retentionCount := current.RetentionCount
	if req.RetentionCount != nil && *req.RetentionCount > 0 {
		retentionCount = *req.RetentionCount
	}

	now := time.Now().UTC()
	configID := "sched-" + serviceID

	_, err = m.db.ExecContext(ctx, `
		INSERT INTO backup_configs (
			id, service_id, enabled, s3_destination_id, cron_expression, retention_count, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			enabled = excluded.enabled,
			s3_destination_id = excluded.s3_destination_id,
			cron_expression = excluded.cron_expression,
			retention_count = excluded.retention_count,
			updated_at = excluded.updated_at
	`, configID, serviceID, enabled, s3DestID, cronExpr, retentionCount, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to save backup schedule: %w", err)
	}

	m.ReloadSchedule(ctx)
	return m.GetServiceSchedule(ctx, serviceID)
}

func (m *ServiceBackupManager) reloadScheduleLocked(ctx context.Context) {
	// Remove existing entries
	for _, id := range m.entryIDs {
		m.cronRunner.Remove(id)
	}
	m.entryIDs = make(map[string]cron.EntryID)

	cfg, s3Key, err := m.GetGlobalConfigWithDecryptedSecret(ctx)
	if err == nil && cfg != nil && cfg.Enabled && cfg.Bucket != "" && cfg.CronExpression != "" {
		entryID, err := m.cronRunner.AddFunc(cfg.CronExpression, func() {
			bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()
			slog.Info("running scheduled control plane SQLite backup", slog.String("bucket", cfg.Bucket))

			s3Client, err := storage.NewS3Client(bgCtx, storage.S3Config{
				EndpointURL: cfg.EndpointURL,
				Bucket:      cfg.Bucket,
				Region:      cfg.Region,
				AccessKey:   cfg.AccessKey,
				SecretKey:   s3Key,
			})
			if err != nil {
				slog.Error("failed to initialize S3 client for scheduled backup", slog.String("error", err.Error()))
				return
			}

			if _, err := BackupSQLiteControlPlane(bgCtx, m.db, s3Client, cfg.RetentionCount); err != nil {
				slog.Error("scheduled SQLite backup failed", slog.String("error", err.Error()))
			}
		})
		if err != nil {
			slog.Warn("invalid backup cron expression", slog.String("cron", cfg.CronExpression), slog.String("error", err.Error()))
		} else {
			m.entryIDs["global"] = entryID
			slog.Info("registered global backup cron job", slog.String("cron", cfg.CronExpression))
		}
	}

	// Register active service backup schedules
	rows, err := m.db.QueryContext(ctx, `
		SELECT service_id, s3_destination_id, cron_expression
		FROM backup_configs
		WHERE service_id IS NOT NULL AND enabled = 1 AND cron_expression != ''
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var sID, cronEx string
			var s3DestID sql.NullString
			if err := rows.Scan(&sID, &s3DestID, &cronEx); err == nil {
				var destPtr *string
				if s3DestID.Valid {
					destPtr = &s3DestID.String
				}
				targetServiceID := sID
				targetDestID := destPtr
				entryID, err := m.cronRunner.AddFunc(cronEx, func() {
					bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
					defer cancel()
					slog.Info("running scheduled service backup", slog.String("service_id", targetServiceID))
					_, bkpErr := m.TriggerServiceBackup(bgCtx, targetServiceID, models.TriggerBackupRequest{
						S3DestinationID: targetDestID,
					})
					if bkpErr != nil {
						slog.Error("scheduled service backup trigger failed", slog.String("service_id", targetServiceID), slog.String("error", bkpErr.Error()))
					}
				})
				if err != nil {
					slog.Warn("invalid service cron expression", slog.String("service_id", sID), slog.String("cron", cronEx))
				} else {
					m.entryIDs["service:"+sID] = entryID
					slog.Info("registered service backup cron job", slog.String("service_id", sID), slog.String("cron", cronEx))
				}
			}
		}
	}
}

// GetGlobalConfig loads the global S3 backup configuration.
func (m *ServiceBackupManager) GetGlobalConfig(ctx context.Context) (*models.BackupConfig, error) {
	cfg, _, err := m.GetGlobalConfigWithDecryptedSecret(ctx)
	return cfg, err
}

// GetGlobalConfigWithDecryptedSecret returns the config with the plaintext secret key.
func (m *ServiceBackupManager) GetGlobalConfigWithDecryptedSecret(ctx context.Context) (*models.BackupConfig, string, error) {
	row := m.db.QueryRowContext(ctx, `
		SELECT id, service_id, enabled, endpoint_url, bucket, region, access_key,
		       secret_key_encrypted, secret_key_nonce, cron_expression, retention_count,
		       created_at, updated_at
		FROM backup_configs
		WHERE id = 'global'
	`)

	var id string
	var serviceID sql.NullString
	var enabled bool
	var endpointURL, bucket, region, accessKey string
	var encSecret, nonce []byte
	var cronExpr string
	var retentionCount int
	var createdAt, updatedAt time.Time

	err := row.Scan(&id, &serviceID, &enabled, &endpointURL, &bucket, &region, &accessKey,
		&encSecret, &nonce, &cronExpr, &retentionCount, &createdAt, &updatedAt)
	if err == sql.ErrNoRows {
		// Initialize default empty global config
		defaultCfg := &models.BackupConfig{
			ID:             "global",
			Enabled:        false,
			EndpointURL:    "",
			Bucket:         "",
			Region:         "us-east-1",
			AccessKey:      "",
			HasSecretKey:   false,
			CronExpression: "0 2 * * *",
			RetentionCount: 30,
			CreatedAt:      time.Now().UTC(),
			UpdatedAt:      time.Now().UTC(),
		}
		_, _ = m.db.ExecContext(ctx, `
			INSERT OR IGNORE INTO backup_configs (
				id, service_id, enabled, endpoint_url, bucket, region, access_key,
				cron_expression, retention_count, created_at, updated_at
			) VALUES ('global', NULL, 0, '', '', 'us-east-1', '', '0 2 * * *', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`)
		return defaultCfg, "", nil
	} else if err != nil {
		return nil, "", fmt.Errorf("failed to query global backup config: %w", err)
	}

	var secretKey string
	if len(encSecret) > 0 && len(nonce) > 0 && len(m.masterKey) == 32 {
		plain, err := crypto.Decrypt(encSecret, nonce, m.masterKey)
		if err == nil {
			secretKey = string(plain)
		}
	}

	var sID *string
	if serviceID.Valid {
		sID = &serviceID.String
	}

	return &models.BackupConfig{
		ID:             id,
		ServiceID:      sID,
		Enabled:        enabled,
		EndpointURL:    endpointURL,
		Bucket:         bucket,
		Region:         region,
		AccessKey:      accessKey,
		HasSecretKey:   secretKey != "",
		CronExpression: cronExpr,
		RetentionCount: retentionCount,
		CreatedAt:      createdAt,
		UpdatedAt:      updatedAt,
	}, secretKey, nil
}

// SaveGlobalConfig updates the global S3 backup configuration.
func (m *ServiceBackupManager) SaveGlobalConfig(ctx context.Context, req models.UpdateBackupConfigRequest) (*models.BackupConfig, error) {
	current, existingSecret, err := m.GetGlobalConfigWithDecryptedSecret(ctx)
	if err != nil {
		return nil, err
	}

	enabled := current.Enabled
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	endpointURL := current.EndpointURL
	if req.EndpointURL != nil {
		endpointURL = strings.TrimSpace(*req.EndpointURL)
	}
	bucket := current.Bucket
	if req.Bucket != nil {
		bucket = strings.TrimSpace(*req.Bucket)
	}
	region := current.Region
	if req.Region != nil && *req.Region != "" {
		region = strings.TrimSpace(*req.Region)
	}
	accessKey := current.AccessKey
	if req.AccessKey != nil {
		accessKey = strings.TrimSpace(*req.AccessKey)
	}
	secretKey := existingSecret
	if req.SecretKey != nil && *req.SecretKey != "" {
		secretKey = strings.TrimSpace(*req.SecretKey)
	}
	cronExpr := current.CronExpression
	if req.CronExpression != nil && *req.CronExpression != "" {
		cronExpr = strings.TrimSpace(*req.CronExpression)
	}
	retentionCount := current.RetentionCount
	if req.RetentionCount != nil && *req.RetentionCount > 0 {
		retentionCount = *req.RetentionCount
	}

	var encSecret, nonce []byte
	if secretKey != "" && len(m.masterKey) == 32 {
		enc, n, err := crypto.Encrypt([]byte(secretKey), m.masterKey)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt secret key: %w", err)
		}
		encSecret = enc
		nonce = n
	}

	_, err = m.db.ExecContext(ctx, `
		INSERT INTO backup_configs (
			id, service_id, enabled, endpoint_url, bucket, region, access_key,
			secret_key_encrypted, secret_key_nonce, cron_expression, retention_count,
			updated_at
		) VALUES ('global', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(id) DO UPDATE SET
			enabled = excluded.enabled,
			endpoint_url = excluded.endpoint_url,
			bucket = excluded.bucket,
			region = excluded.region,
			access_key = excluded.access_key,
			secret_key_encrypted = COALESCE(excluded.secret_key_encrypted, backup_configs.secret_key_encrypted),
			secret_key_nonce = COALESCE(excluded.secret_key_nonce, backup_configs.secret_key_nonce),
			cron_expression = excluded.cron_expression,
			retention_count = excluded.retention_count,
			updated_at = CURRENT_TIMESTAMP
	`, enabled, endpointURL, bucket, region, accessKey, encSecret, nonce, cronExpr, retentionCount)
	if err != nil {
		return nil, fmt.Errorf("failed to save global backup config: %w", err)
	}

	m.ReloadSchedule(ctx)
	return m.GetGlobalConfig(ctx)
}

// TriggerServiceBackup initiates an on-demand database dump or volume backup on the assigned node.
func (m *ServiceBackupManager) TriggerServiceBackup(
	ctx context.Context,
	serviceID string,
	req models.TriggerBackupRequest,
) (*models.BackupRecord, error) {
	// Query service details
	var serverID, name string
	var serviceType string
	var databaseEngine, databaseName, databaseUser sql.NullString
	var dbPassEnc, dbPassNonce []byte
	var volumeName, volumeMountPath sql.NullString

	row := m.db.QueryRowContext(ctx, `
		SELECT server_id, name, service_type, database_engine, database_name, database_user,
		       database_password_encrypted, database_password_nonce, volume_name, volume_mount_path
		FROM services
		WHERE id = ?
	`, serviceID)
	err := row.Scan(&serverID, &name, &serviceType, &databaseEngine, &databaseName, &databaseUser,
		&dbPassEnc, &dbPassNonce, &volumeName, &volumeMountPath)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("service not found: %s", serviceID)
	} else if err != nil {
		return nil, fmt.Errorf("failed to query service: %w", err)
	}

	// Decrypt database password if present
	var dbPassword string
	if len(dbPassEnc) > 0 && len(dbPassNonce) > 0 && len(m.masterKey) == 32 {
		plain, err := crypto.Decrypt(dbPassEnc, dbPassNonce, m.masterKey)
		if err == nil {
			dbPassword = string(plain)
		}
	}

	// Determine backup type
	backupType := models.BackupTypeDatabase
	if req.BackupType != nil && *req.BackupType == "volume" {
		backupType = models.BackupTypeVolume
	} else if serviceType != "database" && volumeName.Valid && volumeName.String != "" {
		backupType = models.BackupTypeVolume
	}

	// Resolve target S3 destination: explicit request -> service backup_config -> default S3 destination -> legacy global
	var requestedDestID *string
	if req.S3DestinationID != nil && strings.TrimSpace(*req.S3DestinationID) != "" {
		trimmed := strings.TrimSpace(*req.S3DestinationID)
		requestedDestID = &trimmed
	} else {
		var serviceDestID sql.NullString
		_ = m.db.QueryRowContext(ctx, "SELECT s3_destination_id FROM backup_configs WHERE service_id = ?", serviceID).Scan(&serviceDestID)
		if serviceDestID.Valid && serviceDestID.String != "" {
			requestedDestID = &serviceDestID.String
		}
	}

	dest, err := m.ResolveS3Destination(ctx, requestedDestID)
	if err != nil {
		return nil, err
	}

	recordID := uuid.New().String()
	timestamp := time.Now().UTC()
	timeStr := timestamp.Format("20060102-150405")
	ext := "dump.gz"
	if backupType == models.BackupTypeVolume {
		ext = "tar.gz"
	}
	fileName := fmt.Sprintf("%s-%s-%s.%s", name, timeStr, recordID[:8], ext)
	s3Key := fmt.Sprintf("backups/services/%s/%s", serviceID, fileName)

	// Create pending backup record
	var dbEnginePtr *string
	if databaseEngine.Valid {
		dbEnginePtr = &databaseEngine.String
	}
	var storedDestID *string
	if dest.ID != "" {
		storedDestID = &dest.ID
	}

	_, err = m.db.ExecContext(ctx, `
		INSERT INTO backup_records (
			id, service_id, server_id, backup_type, database_engine,
			status, file_name, s3_key, file_size_bytes, s3_destination_id, created_at
		) VALUES (?, ?, ?, ?, ?, 'running', ?, ?, 0, ?, ?)
	`, recordID, serviceID, serverID, string(backupType), dbEnginePtr, fileName, s3Key, storedDestID, timestamp)
	if err != nil {
		return nil, fmt.Errorf("failed to insert backup record: %w", err)
	}

	if m.nodeSender == nil {
		return nil, fmt.Errorf("node manager is not initialized")
	}

	// Build BackupCommand for agent with resolved destination
	taskID := "backup-" + recordID
	backupCmd := &protocol.BackupCommand{
		TaskId:           taskID,
		ServiceId:        serviceID,
		BackupType:       string(backupType),
		DatabaseEngine:   databaseEngine.String,
		DatabaseName:     databaseName.String,
		DatabaseUser:     databaseUser.String,
		DatabasePassword: dbPassword,
		VolumeName:       volumeName.String,
		VolumeMountPath:  volumeMountPath.String,
		S3Key:            s3Key,
		S3Config: &protocol.S3StorageConfig{
			EndpointUrl: dest.EndpointURL,
			Bucket:      dest.Bucket,
			Region:      dest.Region,
			AccessKey:   dest.AccessKey,
			SecretKey:   dest.SecretKey,
		},
	}

	serverMsg := &protocol.ServerMessage{
		Payload: &protocol.ServerMessage_BackupCommand{
			BackupCommand: backupCmd,
		},
	}

	// Execute on agent asynchronously so the request doesn't timeout
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()

		ack, err := m.nodeSender.SendTaskWithResponse(bgCtx, serverID, taskID, serverMsg)
		now := time.Now().UTC()
		if err != nil || ack == nil || !ack.GetSuccess() {
			errMsg := "backup failed"
			if err != nil {
				errMsg = err.Error()
			} else if ack != nil && ack.GetMessage() != "" {
				errMsg = ack.GetMessage()
			}
			_, _ = m.db.ExecContext(bgCtx, `
				UPDATE backup_records SET
					status = 'failed',
					error_message = ?,
					completed_at = ?
				WHERE id = ?
			`, errMsg, now, recordID)
			return
		}

		// Marked completed
		fileSizeBytes := ack.GetBackupSizeBytes()
		_, _ = m.db.ExecContext(bgCtx, `
			UPDATE backup_records SET
				status = 'completed',
				file_size_bytes = ?,
				completed_at = ?
			WHERE id = ?
		`, fileSizeBytes, now, recordID)

		// Enforce retention for this service and destination
		retCount := 30
		var schedRetention sql.NullInt64
		_ = m.db.QueryRowContext(bgCtx, "SELECT retention_count FROM backup_configs WHERE service_id = ?", serviceID).Scan(&schedRetention)
		if schedRetention.Valid && schedRetention.Int64 > 0 {
			retCount = int(schedRetention.Int64)
		}
		_ = m.EnforceServiceRetention(bgCtx, serviceID, storedDestID, retCount)
	}()

	var destNamePtr *string
	if dest.Name != "" {
		destNamePtr = &dest.Name
	}

	return &models.BackupRecord{
		ID:                recordID,
		ServiceID:         &serviceID,
		ServerID:          &serverID,
		BackupType:        backupType,
		DatabaseEngine:    dbEnginePtr,
		Status:            models.BackupStatusRunning,
		FileName:          fileName,
		S3Key:             s3Key,
		FileSizeBytes:     0,
		S3DestinationID:   storedDestID,
		S3DestinationName: destNamePtr,
		CreatedAt:         timestamp,
	}, nil
}

// RestoreServiceBackup restores a backup into the service container.
func (m *ServiceBackupManager) RestoreServiceBackup(
	ctx context.Context,
	serviceID string,
	backupID string,
) (*models.SuccessResponse, error) {
	// Query backup record including s3_destination_id
	var record models.BackupRecord
	var bType, status string
	var dbEngine, destID sql.NullString
	row := m.db.QueryRowContext(ctx, `
		SELECT id, service_id, server_id, backup_type, database_engine, status, file_name, s3_key, file_size_bytes, s3_destination_id
		FROM backup_records
		WHERE id = ? AND service_id = ?
	`, backupID, serviceID)
	err := row.Scan(&record.ID, &record.ServiceID, &record.ServerID, &bType, &dbEngine, &status, &record.FileName, &record.S3Key, &record.FileSizeBytes, &destID)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("backup record not found: %s", backupID)
	} else if err != nil {
		return nil, fmt.Errorf("failed to query backup record: %w", err)
	}

	if status != "completed" {
		return nil, fmt.Errorf("only completed backups can be restored (current status: %s)", status)
	}

	// Query service details
	var serverID string
	var databaseName, databaseUser sql.NullString
	var dbPassEnc, dbPassNonce []byte
	var volumeName, volumeMountPath sql.NullString
	row = m.db.QueryRowContext(ctx, `
		SELECT server_id, database_name, database_user, database_password_encrypted, database_password_nonce,
		       volume_name, volume_mount_path
		FROM services
		WHERE id = ?
	`, serviceID)
	err = row.Scan(&serverID, &databaseName, &databaseUser, &dbPassEnc, &dbPassNonce, &volumeName, &volumeMountPath)
	if err != nil {
		return nil, fmt.Errorf("failed to query service: %w", err)
	}

	var dbPassword string
	if len(dbPassEnc) > 0 && len(dbPassNonce) > 0 && len(m.masterKey) == 32 {
		plain, err := crypto.Decrypt(dbPassEnc, dbPassNonce, m.masterKey)
		if err == nil {
			dbPassword = string(plain)
		}
	}

	var destPtr *string
	if destID.Valid && destID.String != "" {
		destPtr = &destID.String
	}
	dest, err := m.ResolveS3Destination(ctx, destPtr)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve destination for backup: %w", err)
	}

	taskID := "restore-" + uuid.New().String()
	restoreCmd := &protocol.RestoreCommand{
		TaskId:           taskID,
		ServiceId:        serviceID,
		BackupType:       bType,
		DatabaseEngine:   dbEngine.String,
		DatabaseName:     databaseName.String,
		DatabaseUser:     databaseUser.String,
		DatabasePassword: dbPassword,
		VolumeName:       volumeName.String,
		VolumeMountPath:  volumeMountPath.String,
		S3Key:            record.S3Key,
		S3Config: &protocol.S3StorageConfig{
			EndpointUrl: dest.EndpointURL,
			Bucket:      dest.Bucket,
			Region:      dest.Region,
			AccessKey:   dest.AccessKey,
			SecretKey:   dest.SecretKey,
		},
	}

	serverMsg := &protocol.ServerMessage{
		Payload: &protocol.ServerMessage_RestoreCommand{
			RestoreCommand: restoreCmd,
		},
	}

	ack, err := m.nodeSender.SendTaskWithResponse(ctx, serverID, taskID, serverMsg)
	if err != nil {
		return nil, fmt.Errorf("restore command failed: %w", err)
	}
	if ack == nil || !ack.GetSuccess() {
		msg := "restore operation failed"
		if ack != nil && ack.GetMessage() != "" {
			msg = ack.GetMessage()
		}
		return nil, fmt.Errorf("%s", msg)
	}

	return &models.SuccessResponse{
		Success: true,
		Message: "Backup restored successfully.",
	}, nil
}

// EnforceServiceRetention cleans up older backups for a specific service and destination.
func (m *ServiceBackupManager) EnforceServiceRetention(
	ctx context.Context,
	serviceID string,
	targetDestID *string,
	retentionCount int,
	testUploader ...StorageUploader,
) error {
	var rows *sql.Rows
	var err error
	if targetDestID != nil && *targetDestID != "" {
		rows, err = m.db.QueryContext(ctx, `
			SELECT id, s3_key, s3_destination_id
			FROM backup_records
			WHERE service_id = ? AND status = 'completed' AND s3_destination_id = ?
			ORDER BY created_at DESC
		`, serviceID, *targetDestID)
	} else {
		rows, err = m.db.QueryContext(ctx, `
			SELECT id, s3_key, s3_destination_id
			FROM backup_records
			WHERE service_id = ? AND status = 'completed' AND (s3_destination_id IS NULL OR s3_destination_id = '')
			ORDER BY created_at DESC
		`, serviceID)
	}
	if err != nil {
		return err
	}
	defer rows.Close()

	type item struct {
		id     string
		s3Key  string
		destID sql.NullString
	}
	var allBackups []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.id, &it.s3Key, &it.destID); err != nil {
			return err
		}
		allBackups = append(allBackups, it)
	}

	if len(allBackups) <= retentionCount {
		return nil
	}

	expired := allBackups[retentionCount:]
	for _, exp := range expired {
		if len(testUploader) > 0 && testUploader[0] != nil {
			_ = testUploader[0].Delete(ctx, exp.s3Key)
		} else {
			var dID *string
			if exp.destID.Valid && exp.destID.String != "" {
				dID = &exp.destID.String
			}
			if s3Dest, err := m.ResolveS3Destination(ctx, dID); err == nil {
				if s3Client, err := storage.NewS3Client(ctx, storage.S3Config{
					EndpointURL:  s3Dest.EndpointURL,
					Region:       s3Dest.Region,
					Bucket:       s3Dest.Bucket,
					AccessKey:    s3Dest.AccessKey,
					SecretKey:    s3Dest.SecretKey,
					UsePathStyle: s3Dest.UsePathStyle,
				}); err == nil {
					_ = s3Client.Delete(ctx, exp.s3Key)
				}
			}
		}
		_, _ = m.db.ExecContext(ctx, "DELETE FROM backup_records WHERE id = ?", exp.id)
		slog.Info("pruned expired service backup", slog.String("service_id", serviceID), slog.String("s3_key", exp.s3Key))
	}

	return nil
}
