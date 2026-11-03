package api

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

// ServiceBackupConfig describes the backup schedule, database target, retention, and target S3 bucket for a service container.
type ServiceBackupConfig struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	Enabled             bool   `json:"enabled"`
	CronSchedule        string `json:"cronSchedule"` // e.g. "0 2 * * *"
	TargetContainer     string `json:"targetContainer"`
	DatabaseType        string `json:"databaseType"` // "postgres", "mysql", "mariadb", "redis", "mongodb", "auto", "none"
	DatabaseName        string `json:"databaseName,omitempty"`
	DatabaseUser        string `json:"databaseUser,omitempty"`
	RetentionDays       int    `json:"retentionDays"`
	DestinationBucketID string `json:"destinationBucketId"`
	Prefix              string `json:"prefix"`
	LastBackupAt        string `json:"lastBackupAt,omitempty"`
	LastBackupStatus    string `json:"lastBackupStatus,omitempty"`
}

func defaultServiceBackupConfigs(srv db.Service) []ServiceBackupConfig {
	slug := srv.Slug
	if slug == "" {
		slug = srv.ID
	}
	dbType := srv.DatabaseType
	if dbType == "" {
		dbType = "auto"
	}
	name := "Database Backup"
	if dbType != "none" && dbType != "auto" {
		name = strings.ToUpper(dbType[:1]) + dbType[1:] + " Backup"
	}

	return []ServiceBackupConfig{
		{
			ID:                  "backup-" + randomHexID(6),
			Name:                name,
			Enabled:             false,
			CronSchedule:        "0 2 * * *", // 02:00 AM daily
			TargetContainer:     "tako-app-" + slug,
			DatabaseType:        dbType,
			DatabaseName:        "",
			DatabaseUser:        "",
			RetentionDays:       14,
			DestinationBucketID: "",
			Prefix:              fmt.Sprintf("services/%s/backups/", slug),
			LastBackupStatus:    "idle",
		},
	}
}

func parseStoredBackupConfigs(settingValue string, srv db.Service) []ServiceBackupConfig {
	if settingValue == "" {
		return defaultServiceBackupConfigs(srv)
	}

	// Try array first
	var list []ServiceBackupConfig
	if err := json.Unmarshal([]byte(settingValue), &list); err == nil && len(list) > 0 {
		return list
	}

	// Fallback: try single object migration
	var single ServiceBackupConfig
	if err := json.Unmarshal([]byte(settingValue), &single); err == nil && single.CronSchedule != "" {
		if single.ID == "" {
			single.ID = "backup-" + randomHexID(6)
		}
		if single.Name == "" {
			single.Name = "Default Backup"
		}
		return []ServiceBackupConfig{single}
	}

	return defaultServiceBackupConfigs(srv)
}

func handleGetServiceBackup(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		srv, err := orch.Queries().GetServiceByID(r.Context(), id)
		if err != nil {
			RespondError(w, http.StatusNotFound, "service not found")
			return
		}

		key := fmt.Sprintf("service_backup_%s", id)
		setting, err := orch.Queries().GetSetting(r.Context(), key)
		if err != nil || setting.Value == "" {
			RespondJSON(w, http.StatusOK, defaultServiceBackupConfigs(srv))
			return
		}

		configs := parseStoredBackupConfigs(setting.Value, srv)
		RespondJSON(w, http.StatusOK, configs)
	}
}

func handleUpdateServiceBackup(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		srv, err := orch.Queries().GetServiceByID(r.Context(), id)
		if err != nil {
			RespondError(w, http.StatusNotFound, "service not found")
			return
		}

		var configs []ServiceBackupConfig
		// Also allow client to pass a single object or array
		var body json.RawMessage
		if err := DecodeJSON(r, &body); err != nil {
			RespondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if err := json.Unmarshal(body, &configs); err != nil {
			var single ServiceBackupConfig
			if err2 := json.Unmarshal(body, &single); err2 != nil {
				RespondError(w, http.StatusBadRequest, "invalid backup config format")
				return
			}
			configs = []ServiceBackupConfig{single}
		}

		// Normalize configs
		for i := range configs {
			if configs[i].ID == "" {
				configs[i].ID = "backup-" + randomHexID(6)
			}
			if configs[i].Name == "" {
				configs[i].Name = fmt.Sprintf("Backup Plan %d", i+1)
			}
			if configs[i].RetentionDays <= 0 {
				configs[i].RetentionDays = 14
			}
			if configs[i].CronSchedule == "" {
				configs[i].CronSchedule = "0 2 * * *"
			}
			if configs[i].TargetContainer == "" {
				configs[i].TargetContainer = "tako-app-" + srv.Slug
			}
			if configs[i].DatabaseType == "" {
				configs[i].DatabaseType = "auto"
			}
			if configs[i].Prefix == "" {
				configs[i].Prefix = fmt.Sprintf("services/%s/backups/", srv.Slug)
			}
		}

		data, err := json.Marshal(configs)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "failed to serialize backup config")
			return
		}

		key := fmt.Sprintf("service_backup_%s", id)
		_, err = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
			Key:   key,
			Value: string(data),
		})
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "failed to save backup configuration")
			return
		}

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "update_service_backup_config",
			TargetType: "service",
			TargetID:   srv.ID,
			TargetName: srv.Name,
			Metadata: map[string]any{
				"totalConfigs": len(configs),
			},
		})

		RespondJSON(w, http.StatusOK, configs)
	}
}

func handleTriggerServiceBackup(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		srv, err := orch.Queries().GetServiceByID(r.Context(), id)
		if err != nil {
			RespondError(w, http.StatusNotFound, "service not found")
			return
		}

		key := fmt.Sprintf("service_backup_%s", id)
		var storedConfigs []ServiceBackupConfig
		if setting, sErr := orch.Queries().GetSetting(r.Context(), key); sErr == nil && setting.Value != "" {
			storedConfigs = parseStoredBackupConfigs(setting.Value, srv)
		} else {
			storedConfigs = defaultServiceBackupConfigs(srv)
		}

		// Optional request body overrides for backupId, containerName, databaseType, or destinationBucketId
		var triggerReq struct {
			BackupID            string `json:"backupId"`
			TargetContainer     string `json:"targetContainer"`
			DatabaseType        string `json:"databaseType"`
			DatabaseName        string `json:"databaseName"`
			DatabaseUser        string `json:"databaseUser"`
			DestinationBucketID string `json:"destinationBucketId"`
		}
		_ = DecodeJSON(r, &triggerReq)

		var selectedConfig ServiceBackupConfig
		selectedIndex := -1
		if triggerReq.BackupID != "" {
			for idx, c := range storedConfigs {
				if c.ID == triggerReq.BackupID {
					selectedConfig = c
					selectedIndex = idx
					break
				}
			}
		}
		if selectedIndex == -1 && len(storedConfigs) > 0 {
			selectedConfig = storedConfigs[0]
			selectedIndex = 0
		}

		// Apply manual request overrides if specified
		if triggerReq.TargetContainer != "" {
			selectedConfig.TargetContainer = triggerReq.TargetContainer
		}
		if triggerReq.DatabaseType != "" {
			selectedConfig.DatabaseType = triggerReq.DatabaseType
		}
		if triggerReq.DatabaseName != "" {
			selectedConfig.DatabaseName = triggerReq.DatabaseName
		}
		if triggerReq.DatabaseUser != "" {
			selectedConfig.DatabaseUser = triggerReq.DatabaseUser
		}
		if triggerReq.DestinationBucketID != "" {
			selectedConfig.DestinationBucketID = triggerReq.DestinationBucketID
		}

		targetBucketID := selectedConfig.DestinationBucketID

		backupDir := getBackupDir()
		now := time.Now().UTC()
		timestamp := now.Format("20060102-150405")
		filename := fmt.Sprintf("service-%s-%s.tar.gz", srv.Slug, timestamp)
		archivePath := filepath.Join(backupDir, filename)

		// Create service backup archive containing metadata, env vars, domains, and database dump (if stateful)
		domains, _ := orch.Queries().ListServiceDomains(r.Context(), srv.ID)
		envVars, _ := orch.Queries().ListServiceEnvVars(r.Context(), srv.ID)

		// Determine target database type and container
		targetContainer := selectedConfig.TargetContainer
		if targetContainer == "" {
			targetContainer = "tako-app-" + srv.Slug
		}

		dbType := selectedConfig.DatabaseType
		if dbType == "" || dbType == "auto" {
			if srv.DatabaseType != "" {
				dbType = srv.DatabaseType
			} else {
				dbType = detectDatabaseTypeFromEnv(envVars, targetContainer)
			}
		}

		// Perform database dump if database container/type detected
		var dbDumpBytes []byte
		var dbDumpFilename string
		if dbType != "none" && srv.NodeID != "" {
			dumpOut, dumpFile, _ := performDatabaseDump(r.Context(), orch, srv.NodeID, targetContainer, dbType, selectedConfig.DatabaseName, selectedConfig.DatabaseUser, envVars)
			if len(dumpOut) > 0 {
				dbDumpBytes = dumpOut
				dbDumpFilename = dumpFile
			}
		}

		payload := map[string]any{
			"service":      srv,
			"domains":      domains,
			"envVars":      envVars,
			"backupAt":     now.Format(time.RFC3339),
			"version":      "1.0",
			"backupPlan":   selectedConfig.Name,
			"databaseType": dbType,
			"hasDbDump":    len(dbDumpBytes) > 0,
			"dbDumpFile":   dbDumpFilename,
			"container":    targetContainer,
		}

		manifestBytes, err := json.MarshalIndent(payload, "", "  ")
		if err != nil {
			RespondError(w, http.StatusInternalServerError, "failed to serialize service metadata")
			return
		}

		tarGzFile, err := os.Create(archivePath)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, fmt.Sprintf("failed to create archive file: %v", err))
			return
		}

		gzWriter := gzip.NewWriter(tarGzFile)
		tarWriter := tar.NewWriter(gzWriter)

		manifestHeader := &tar.Header{
			Name:    "service-manifest.json",
			Mode:    0o644,
			Size:    int64(len(manifestBytes)),
			ModTime: now,
		}
		if err := tarWriter.WriteHeader(manifestHeader); err != nil {
			_ = tarWriter.Close()
			_ = gzWriter.Close()
			_ = tarGzFile.Close()
			RespondError(w, http.StatusInternalServerError, "failed to write archive header")
			return
		}
		if _, err := tarWriter.Write(manifestBytes); err != nil {
			_ = tarWriter.Close()
			_ = gzWriter.Close()
			_ = tarGzFile.Close()
			RespondError(w, http.StatusInternalServerError, "failed to write archive content")
			return
		}

		// Write database dump file if generated
		if len(dbDumpBytes) > 0 && dbDumpFilename != "" {
			dumpHeader := &tar.Header{
				Name:    dbDumpFilename,
				Mode:    0o644,
				Size:    int64(len(dbDumpBytes)),
				ModTime: now,
			}
			if err := tarWriter.WriteHeader(dumpHeader); err == nil {
				_, _ = tarWriter.Write(dbDumpBytes)
			}
		}

		_ = tarWriter.Close()
		_ = gzWriter.Close()
		_ = tarGzFile.Close()

		fi, _ := os.Stat(archivePath)
		sizeBytes := int64(0)
		if fi != nil {
			sizeBytes = fi.Size()
		}
		sizeMb := float64(sizeBytes) / (1024 * 1024)

		// Calculate checksum
		h := sha256.New()
		if fData, rErr := os.ReadFile(archivePath); rErr == nil {
			h.Write(fData)
		}
		checksum := hex.EncodeToString(h.Sum(nil))

		// Upload to specified S3 storage bucket
		s3Err := uploadSnapshotToS3(r.Context(), orch, archivePath, filename, targetBucketID)
		s3Uploaded := s3Err == nil

		// Update service backup metadata
		selectedConfig.LastBackupAt = now.Format(time.RFC3339)
		if s3Uploaded {
			selectedConfig.LastBackupStatus = "completed"
		} else {
			selectedConfig.LastBackupStatus = "local_only"
		}

		if selectedIndex >= 0 && selectedIndex < len(storedConfigs) {
			storedConfigs[selectedIndex] = selectedConfig
			if updatedData, mErr := json.Marshal(storedConfigs); mErr == nil {
				_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
					Key:   key,
					Value: string(updatedData),
				})
			}
		}

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "create_service_backup",
			TargetType: "service",
			TargetID:   srv.ID,
			TargetName: srv.Name,
			Metadata: map[string]any{
				"filename":            filename,
				"sizeBytes":           sizeBytes,
				"destinationBucketId": targetBucketID,
				"s3Synced":            s3Uploaded,
				"backupPlan":          selectedConfig.Name,
				"container":           targetContainer,
			},
		})

		s3Msg := "Backup saved locally and successfully uploaded to S3 destination."
		if !s3Uploaded {
			if s3Err != nil {
				s3Msg = fmt.Sprintf("Backup saved locally (S3 upload notice: %v).", s3Err)
			} else {
				s3Msg = "Backup saved locally (no S3 destination configured)."
			}
		}

		RespondJSON(w, http.StatusOK, map[string]any{
			"ok":           true,
			"message":      s3Msg,
			"filename":     filename,
			"sizeBytes":  sizeBytes,
			"sizeMb":       float64(int(sizeMb*100)) / 100,
			"checksum":     checksum,
			"s3Synced":     s3Uploaded,
			"bucketId":     targetBucketID,
			"lastBackup":   selectedConfig.LastBackupAt,
			"databaseType": dbType,
			"hasDbDump":    len(dbDumpBytes) > 0,
			"container":    targetContainer,
			"planName":     selectedConfig.Name,
		})
	}
}

func detectDatabaseTypeFromEnv(envVars []db.ServiceEnvVar, containerName string) string {
	lowerContainer := strings.ToLower(containerName)
	if strings.Contains(lowerContainer, "postgres") || strings.Contains(lowerContainer, "pgsql") {
		return "postgres"
	}
	if strings.Contains(lowerContainer, "mysql") {
		return "mysql"
	}
	if strings.Contains(lowerContainer, "mariadb") {
		return "mariadb"
	}
	if strings.Contains(lowerContainer, "redis") || strings.Contains(lowerContainer, "valkey") {
		return "redis"
	}
	if strings.Contains(lowerContainer, "mongo") {
		return "mongodb"
	}

	for _, ev := range envVars {
		k := strings.ToUpper(ev.Key)
		if strings.Contains(k, "POSTGRES") || strings.Contains(k, "PGDATA") {
			return "postgres"
		}
		if strings.Contains(k, "MYSQL") {
			return "mysql"
		}
		if strings.Contains(k, "MONGO") {
			return "mongodb"
		}
		if strings.Contains(k, "REDIS") {
			return "redis"
		}
	}

	return "none"
}

func performDatabaseDump(ctx context.Context, orch *orchestrator.Orchestrator, nodeID, containerName, dbType, dbName, dbUser string, envVars []db.ServiceEnvVar) ([]byte, string, error) {
	var cmd string
	var filename string

	switch dbType {
	case "postgres":
		user := dbUser
		if user == "" {
			user = findEnvValue(envVars, "POSTGRES_USER", "postgres")
		}
		database := dbName
		if database == "" {
			database = findEnvValue(envVars, "POSTGRES_DB", user)
		}
		cmd = fmt.Sprintf("pg_dump -U %s -d %s --clean --if-exists", user, database)
		filename = "database_dump.sql"

	case "mysql", "mariadb":
		user := dbUser
		if user == "" {
			user = findEnvValue(envVars, "MYSQL_USER", "root")
		}
		pass := findEnvValue(envVars, "MYSQL_PASSWORD", findEnvValue(envVars, "MYSQL_ROOT_PASSWORD", ""))
		database := dbName
		if database == "" {
			database = findEnvValue(envVars, "MYSQL_DATABASE", "")
		}

		passArg := ""
		if pass != "" {
			passArg = fmt.Sprintf("-p'%s'", pass)
		}

		dbArg := "--all-databases"
		if database != "" {
			dbArg = database
		}
		cmd = fmt.Sprintf("mysqldump -u %s %s %s", user, passArg, dbArg)
		filename = "database_dump.sql"

	case "redis":
		cmd = "redis-cli bgsave && sleep 1 && cat /data/dump.rdb 2>/dev/null || redis-cli --rdb /tmp/dump.rdb && cat /tmp/dump.rdb"
		filename = "dump.rdb"

	case "mongodb":
		cmd = "mongodump --archive"
		filename = "mongo_dump.archive"

	default:
		return nil, "", nil
	}

	out, code, err := orch.DispatchExec(ctx, nodeID, containerName, cmd)
	if err != nil || code != 0 {
		return nil, "", fmt.Errorf("database dump failed (exit %d): %v", code, err)
	}

	return []byte(out), filename, nil
}

func findEnvValue(envVars []db.ServiceEnvVar, key, fallback string) string {
	for _, ev := range envVars {
		if strings.EqualFold(ev.Key, key) && ev.Value != "" {
			return ev.Value
		}
	}
	return fallback
}
