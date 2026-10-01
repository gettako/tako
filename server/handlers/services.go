package handlers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/compose"
	"gettako.dev/tako/internal/crypto"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
	"gettako.dev/tako/server/audit"
)

func generateSecurePassword(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}
	return string(b)
}

func (h *Handler) ListServices(w http.ResponseWriter, r *http.Request) {
	projectID := r.URL.Query().Get("project_id")
	serverID := r.URL.Query().Get("server_id")
	parentServiceID := r.URL.Query().Get("parent_service_id")

	query := `
		SELECT id, project_id, server_id, name, service_type, parent_service_id, command, cron_expression,
		       repository, branch, dockerfile_path, internal_port, published_port, health_check_path, status,
		       primary_domain, active_deployment_id, auto_deploy, trigger_on_push, trigger_on_tag, tag_pattern, deploy_key_public,
		       database_engine, database_version, database_name, database_user,
		       volume_name, volume_mount_path, connection_uri,
		       pre_deploy_command, post_deploy_command,
		       compose_file_content, compose_file_path,
		       github_connection_id,
		       created_at, updated_at
		FROM services
	`
	var whereClauses []string
	var args []any
	if projectID != "" {
		whereClauses = append(whereClauses, "project_id = ?")
		args = append(args, projectID)
	}
	if serverID != "" {
		whereClauses = append(whereClauses, "server_id = ?")
		args = append(args, serverID)
	}
	if parentServiceID != "" {
		whereClauses = append(whereClauses, "parent_service_id = ?")
		args = append(args, parentServiceID)
	}
	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}
	query += " ORDER BY created_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to query services")
		return
	}
	defer rows.Close()

	services := make([]models.Service, 0)
	for rows.Next() {
		var s models.Service
		var sType string
		var pPubPort sql.NullInt64
		var pParentID, pCmd, pCronExpr, pDom, actDep, pPubKey, pTagPattern sql.NullString
		var pDBEngine, pDBVersion, pDBName, pDBUser, pVolName, pVolMount, pConnURI sql.NullString
		var pPreDeploy, pPostDeploy sql.NullString
		var pComposeContent, pComposePath, pGHConnID sql.NullString
		var createdAtStr, updatedAtStr string

		err := rows.Scan(
			&s.ID, &s.ProjectID, &s.ServerID, &s.Name, &sType, &pParentID, &pCmd, &pCronExpr,
			&s.Repository, &s.Branch, &s.DockerfilePath, &s.InternalPort, &pPubPort, &s.HealthCheckPath, &s.Status,
			&pDom, &actDep, &s.AutoDeploy, &s.TriggerOnPush, &s.TriggerOnTag, &pTagPattern, &pPubKey,
			&pDBEngine, &pDBVersion, &pDBName, &pDBUser,
			&pVolName, &pVolMount, &pConnURI,
			&pPreDeploy, &pPostDeploy,
			&pComposeContent, &pComposePath,
			&pGHConnID,
			&createdAtStr, &updatedAtStr,
		)
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to read service row")
			return
		}

		if pTagPattern.Valid {
			s.TagPattern = &pTagPattern.String
		}

		if sType == "" {
			s.ServiceType = models.ServiceTypeWeb
		} else {
			s.ServiceType = models.ServiceType(sType)
		}
		if pParentID.Valid {
			s.ParentServiceID = &pParentID.String
		}
		if pCmd.Valid {
			s.Command = &pCmd.String
		}
		if pCronExpr.Valid {
			s.CronExpression = &pCronExpr.String
		}
		if pPreDeploy.Valid {
			s.PreDeployCommand = &pPreDeploy.String
		}
		if pPostDeploy.Valid {
			s.PostDeployCommand = &pPostDeploy.String
		}
		if pComposeContent.Valid {
			s.ComposeFileContent = &pComposeContent.String
		}
		if pComposePath.Valid {
			s.ComposeFilePath = &pComposePath.String
		}
		if pPubPort.Valid {
			val := int(pPubPort.Int64)
			s.PublishedPort = &val
		}
		if pDom.Valid {
			s.PrimaryDomain = &pDom.String
		}
		if actDep.Valid {
			s.ActiveDeploymentID = &actDep.String
		}
		if pPubKey.Valid {
			s.DeployKeyPublic = &pPubKey.String
		}
		if pDBEngine.Valid {
			s.DatabaseEngine = &pDBEngine.String
		}
		if pDBVersion.Valid {
			s.DatabaseVersion = &pDBVersion.String
		}
		if pDBName.Valid {
			s.DatabaseName = &pDBName.String
		}
		if pDBUser.Valid {
			s.DatabaseUser = &pDBUser.String
		}
		if pVolName.Valid {
			s.VolumeName = &pVolName.String
		}
		if pVolMount.Valid {
			s.VolumeMountPath = &pVolMount.String
		}
		if pConnURI.Valid {
			s.ConnectionURI = &pConnURI.String
		}
		if pGHConnID.Valid {
			s.GitHubConnectionID = &pGHConnID.String
		}
		s.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
		if s.CreatedAt.IsZero() {
			s.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
		}
		s.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)
		if s.UpdatedAt.IsZero() {
			s.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAtStr)
		}
		services = append(services, s)
	}

	sendJSON(w, http.StatusOK, services)
}

func (h *Handler) CreateService(w http.ResponseWriter, r *http.Request) {
	var req models.CreateServiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		sendError(w, http.StatusBadRequest, "Missing required field: name")
		return
	}

	serviceType := models.ServiceTypeWeb
	if req.ServiceType != nil && *req.ServiceType != "" {
		serviceType = *req.ServiceType
	}

	var parentIDPtr, cmdPtr, cronExprPtr *string
	var preDeployPtr, postDeployPtr *string
	if req.ParentServiceID != nil && strings.TrimSpace(*req.ParentServiceID) != "" {
		pID := strings.TrimSpace(*req.ParentServiceID)
		parentIDPtr = &pID
	}
	if req.Command != nil && strings.TrimSpace(*req.Command) != "" {
		c := strings.TrimSpace(*req.Command)
		cmdPtr = &c
	}
	if req.CronExpression != nil && strings.TrimSpace(*req.CronExpression) != "" {
		ce := strings.TrimSpace(*req.CronExpression)
		cronExprPtr = &ce
	}
	if req.PreDeployCommand != nil && strings.TrimSpace(*req.PreDeployCommand) != "" {
		pd := strings.TrimSpace(*req.PreDeployCommand)
		preDeployPtr = &pd
	}
	if req.PostDeployCommand != nil && strings.TrimSpace(*req.PostDeployCommand) != "" {
		pd := strings.TrimSpace(*req.PostDeployCommand)
		postDeployPtr = &pd
	}

	id := generateID("srv")
	now := time.Now()

	var pDBEnginePtr, pDBVersionPtr, pDBNamePtr, pDBUserPtr, pVolNamePtr, pVolMountPtr, pConnURIPtr *string
	var dbPassEnc, dbPassNonce []byte
	var generatedPassword string

	var pComposeContentPtr, pComposePathPtr *string
	if req.ComposeFileContent != nil && strings.TrimSpace(*req.ComposeFileContent) != "" {
		pComposeContentPtr = req.ComposeFileContent
	}
	if req.ComposeFilePath != nil && strings.TrimSpace(*req.ComposeFilePath) != "" {
		p := strings.TrimSpace(*req.ComposeFilePath)
		pComposePathPtr = &p
	}

	if serviceType == models.ServiceTypeCompose {
		if req.ProjectID == "" || req.ServerID == "" {
			sendError(w, http.StatusBadRequest, "Missing required fields (project_id, server_id)")
			return
		}
		if pComposeContentPtr != nil {
			_, valRes := compose.ParseAndValidate(*pComposeContentPtr)
			if !valRes.Valid {
				sendError(w, http.StatusBadRequest, fmt.Sprintf("Invalid Compose YAML: %s", strings.Join(valRes.Errors, "; ")))
				return
			}
			if req.Repository == "" {
				req.Repository = "inline/compose"
			}
		} else if req.Repository == "" {
			sendError(w, http.StatusBadRequest, "Docker Compose service requires repository or inline compose_file_content")
			return
		}

		if pComposePathPtr == nil {
			defaultPath := "docker-compose.yml"
			pComposePathPtr = &defaultPath
		}
		if req.DockerfilePath == "" {
			req.DockerfilePath = *pComposePathPtr
		}
		if req.InternalPort == 0 {
			req.InternalPort = 80
		}
		if req.HealthCheckPath == "" {
			req.HealthCheckPath = "/"
		}
	} else if serviceType == models.ServiceTypeWorker || serviceType == models.ServiceTypeCron {
		if parentIDPtr == nil {
			sendError(w, http.StatusBadRequest, "Auxiliary service requires parent_service_id")
			return
		}
		if cmdPtr == nil {
			sendError(w, http.StatusBadRequest, "Auxiliary service requires command")
			return
		}
		if serviceType == models.ServiceTypeCron && cronExprPtr == nil {
			sendError(w, http.StatusBadRequest, "Cron service requires cron_expression")
			return
		}

		var parentProjectID, parentServerID, parentRepo, parentBranch, parentDockerfile string
		err := h.db.QueryRow(`
			SELECT project_id, server_id, repository, branch, dockerfile_path
			FROM services WHERE id = ?
		`, *parentIDPtr).Scan(&parentProjectID, &parentServerID, &parentRepo, &parentBranch, &parentDockerfile)
		if err != nil {
			if err == sql.ErrNoRows {
				sendError(w, http.StatusBadRequest, "Parent service not found")
				return
			}
			sendError(w, http.StatusInternalServerError, "Database error finding parent service")
			return
		}

		if req.ProjectID == "" {
			req.ProjectID = parentProjectID
		}
		if req.ServerID == "" {
			req.ServerID = parentServerID
		}
		if req.Repository == "" {
			req.Repository = parentRepo
		}
		if req.Branch == "" {
			req.Branch = parentBranch
		}
		if req.DockerfilePath == "" {
			req.DockerfilePath = parentDockerfile
		}
	} else if serviceType == models.ServiceTypeDatabase {
		if req.ProjectID == "" || req.ServerID == "" {
			sendError(w, http.StatusBadRequest, "Missing required fields (project_id, server_id)")
			return
		}
		if req.DatabaseEngine == nil || strings.TrimSpace(*req.DatabaseEngine) == "" {
			sendError(w, http.StatusBadRequest, "Missing required field: database_engine")
			return
		}

		engine := strings.ToLower(strings.TrimSpace(*req.DatabaseEngine))
		if engine != "postgres" && engine != "mysql" && engine != "redis" && engine != "mariadb" {
			sendError(w, http.StatusBadRequest, "Unsupported database engine: "+engine)
			return
		}
		pDBEnginePtr = &engine

		version := "16-alpine"
		if req.DatabaseVersion != nil && strings.TrimSpace(*req.DatabaseVersion) != "" {
			version = strings.TrimSpace(*req.DatabaseVersion)
		} else {
			if engine == "mysql" {
				version = "8.4"
			} else if engine == "mariadb" {
				version = "11"
			} else if engine == "redis" {
				version = "7-alpine"
			}
		}
		pDBVersionPtr = &version

		intPort := 5432
		if req.InternalPort > 0 {
			intPort = req.InternalPort
		} else {
			if engine == "mysql" || engine == "mariadb" {
				intPort = 3306
			} else if engine == "redis" {
				intPort = 6379
			}
		}
		req.InternalPort = intPort

		mountPath := "/var/lib/postgresql/data"
		if req.VolumeMountPath != nil && strings.TrimSpace(*req.VolumeMountPath) != "" {
			mountPath = strings.TrimSpace(*req.VolumeMountPath)
		} else {
			if engine == "mysql" || engine == "mariadb" {
				mountPath = "/var/lib/mysql"
			} else if engine == "redis" {
				mountPath = "/data"
			}
		}
		pVolMountPtr = &mountPath

		volumeName := fmt.Sprintf("tako_vol_%s_data", id)
		if req.VolumeName != nil && strings.TrimSpace(*req.VolumeName) != "" {
			volumeName = strings.TrimSpace(*req.VolumeName)
		}
		pVolNamePtr = &volumeName

		dbName := "app_db"
		if req.DatabaseName != nil && strings.TrimSpace(*req.DatabaseName) != "" {
			dbName = strings.TrimSpace(*req.DatabaseName)
		} else if engine == "redis" {
			dbName = ""
		}
		if dbName != "" {
			pDBNamePtr = &dbName
		}

		dbUser := "postgres"
		if req.DatabaseUser != nil && strings.TrimSpace(*req.DatabaseUser) != "" {
			dbUser = strings.TrimSpace(*req.DatabaseUser)
		} else if engine == "mysql" || engine == "mariadb" {
			dbUser = "tako_user"
		} else if engine == "redis" {
			dbUser = ""
		}
		if dbUser != "" {
			pDBUserPtr = &dbUser
		}

		if req.DatabasePassword != nil && *req.DatabasePassword != "" {
			generatedPassword = *req.DatabasePassword
		} else {
			generatedPassword = generateSecurePassword(24)
		}

		var connURI string
		if engine == "postgres" {
			connURI = fmt.Sprintf("postgres://%s:%s@tako-%s:%d/%s", dbUser, generatedPassword, id, intPort, dbName)
		} else if engine == "mysql" || engine == "mariadb" {
			connURI = fmt.Sprintf("mysql://%s:%s@tako-%s:%d/%s", dbUser, generatedPassword, id, intPort, dbName)
		} else if engine == "redis" {
			if generatedPassword != "" {
				connURI = fmt.Sprintf("redis://:%s@tako-%s:%d", generatedPassword, id, intPort)
			} else {
				connURI = fmt.Sprintf("redis://tako-%s:%d", id, intPort)
			}
		}
		pConnURIPtr = &connURI

		var encErr error
		dbPassEnc, dbPassNonce, encErr = crypto.Encrypt([]byte(generatedPassword), h.masterKey)
		if encErr != nil {
			sendError(w, http.StatusInternalServerError, "Failed to encrypt database credentials: "+encErr.Error())
			return
		}

		if engine == "redis" && cmdPtr == nil {
			if generatedPassword != "" {
				c := fmt.Sprintf("redis-server --requirepass %s --appendonly yes", generatedPassword)
				cmdPtr = &c
			} else {
				c := "redis-server --appendonly yes"
				cmdPtr = &c
			}
		}

		req.Repository = "curated/" + engine
		req.Branch = "main"
		req.DockerfilePath = engine
		req.HealthCheckPath = "/"
	} else {
		if req.ProjectID == "" || req.ServerID == "" || req.Repository == "" {
			sendError(w, http.StatusBadRequest, "Missing required fields (project_id, server_id, repository)")
			return
		}
		if req.VolumeName != nil && strings.TrimSpace(*req.VolumeName) != "" {
			vn := strings.TrimSpace(*req.VolumeName)
			pVolNamePtr = &vn
		}
		if req.VolumeMountPath != nil && strings.TrimSpace(*req.VolumeMountPath) != "" {
			vmp := strings.TrimSpace(*req.VolumeMountPath)
			pVolMountPtr = &vmp
		}
	}

	if req.Branch == "" {
		req.Branch = "main"
	}
	if req.DockerfilePath == "" {
		req.DockerfilePath = "Dockerfile"
	}
	if req.InternalPort == 0 {
		req.InternalPort = 3000
	}
	if req.HealthCheckPath == "" {
		req.HealthCheckPath = "/healthz"
	}

	autoDeploy := true
	if req.AutoDeploy != nil {
		autoDeploy = *req.AutoDeploy
	}
	triggerOnPush := autoDeploy
	if req.TriggerOnPush != nil {
		triggerOnPush = *req.TriggerOnPush
		autoDeploy = triggerOnPush
	}
	triggerOnTag := false
	if req.TriggerOnTag != nil {
		triggerOnTag = *req.TriggerOnTag
	}
	tagPattern := "*"
	if req.TagPattern != nil && strings.TrimSpace(*req.TagPattern) != "" {
		tagPattern = strings.TrimSpace(*req.TagPattern)
	}

	var pubKey string
	var encPrivKey, nonce []byte
	if strings.HasPrefix(req.Repository, "git@") || strings.HasPrefix(req.Repository, "ssh://") {
		var keyErr error
		pubKey, encPrivKey, nonce, keyErr = crypto.GenerateAndEncryptSSHKeyPair(id, h.masterKey)
		if keyErr != nil {
			sendError(w, http.StatusInternalServerError, "Failed to generate deploy key: "+keyErr.Error())
			return
		}
	}

	var pubKeyPtr *string
	if pubKey != "" {
		pubKeyPtr = &pubKey
	}

	var publishedPortPtr *int
	if req.PublishedPort != nil && *req.PublishedPort > 0 {
		publishedPortPtr = req.PublishedPort
	}

	_, err := h.db.Exec(`
		INSERT INTO services (
			id, project_id, server_id, name, service_type, parent_service_id, command, cron_expression,
			repository, branch, dockerfile_path, internal_port, published_port, health_check_path, status,
			auto_deploy, trigger_on_push, trigger_on_tag, tag_pattern,
			deploy_key_public, deploy_key_private_encrypted, deploy_key_nonce,
			database_engine, database_version, database_name, database_user,
			database_password_encrypted, database_password_nonce,
			volume_name, volume_mount_path, connection_uri,
			pre_deploy_command, post_deploy_command,
			compose_file_content, compose_file_path,
			github_connection_id,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'stopped', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, id, req.ProjectID, req.ServerID, req.Name, string(serviceType), parentIDPtr, cmdPtr, cronExprPtr,
		req.Repository, req.Branch, req.DockerfilePath, req.InternalPort, publishedPortPtr, req.HealthCheckPath,
		autoDeploy, triggerOnPush, triggerOnTag, tagPattern, pubKeyPtr, encPrivKey, nonce,
		pDBEnginePtr, pDBVersionPtr, pDBNamePtr, pDBUserPtr,
		dbPassEnc, dbPassNonce,
		pVolNamePtr, pVolMountPtr, pConnURIPtr,
		preDeployPtr, postDeployPtr,
		pComposeContentPtr, pComposePathPtr,
		req.GitHubConnectionID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to create service: "+err.Error())
		return
	}

	if serviceType == models.ServiceTypeDatabase && pConnURIPtr != nil {
		type envItem struct {
			key   string
			value string
		}
		var envItems []envItem
		if *pDBEnginePtr == "postgres" {
			if pDBNamePtr != nil {
				envItems = append(envItems, envItem{"POSTGRES_DB", *pDBNamePtr})
			}
			if pDBUserPtr != nil {
				envItems = append(envItems, envItem{"POSTGRES_USER", *pDBUserPtr})
			}
			envItems = append(envItems, envItem{"POSTGRES_PASSWORD", generatedPassword})
			envItems = append(envItems, envItem{"DATABASE_URL", *pConnURIPtr})
		} else if *pDBEnginePtr == "mysql" || *pDBEnginePtr == "mariadb" {
			if pDBNamePtr != nil {
				envItems = append(envItems, envItem{"MYSQL_DATABASE", *pDBNamePtr})
			}
			if pDBUserPtr != nil {
				envItems = append(envItems, envItem{"MYSQL_USER", *pDBUserPtr})
			}
			envItems = append(envItems, envItem{"MYSQL_PASSWORD", generatedPassword})
			envItems = append(envItems, envItem{"MYSQL_ROOT_PASSWORD", generatedPassword})
			envItems = append(envItems, envItem{"DATABASE_URL", *pConnURIPtr})
		} else if *pDBEnginePtr == "redis" {
			if generatedPassword != "" {
				envItems = append(envItems, envItem{"REDIS_PASSWORD", generatedPassword})
			}
			envItems = append(envItems, envItem{"REDIS_URL", *pConnURIPtr})
		}

		for _, item := range envItems {
			encVal, nonce, err := crypto.Encrypt([]byte(item.value), h.masterKey)
			if err == nil {
				envID := generateID("env")
				_, _ = h.db.Exec(`
					INSERT INTO env_vars (id, service_id, type, key, value_encrypted, nonce, is_secret, created_at, updated_at)
					VALUES (?, ?, 'env', ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				`, envID, id, item.key, encVal, nonce)
			}
		}
	}

	service := models.Service{
		ID:                 id,
		ProjectID:          req.ProjectID,
		ServerID:           req.ServerID,
		Name:               req.Name,
		ServiceType:        serviceType,
		ParentServiceID:    parentIDPtr,
		Command:            cmdPtr,
		CronExpression:     cronExprPtr,
		PreDeployCommand:   preDeployPtr,
		PostDeployCommand:  postDeployPtr,
		DatabaseEngine:     pDBEnginePtr,
		DatabaseVersion:    pDBVersionPtr,
		DatabaseName:       pDBNamePtr,
		DatabaseUser:       pDBUserPtr,
		VolumeName:         pVolNamePtr,
		VolumeMountPath:    pVolMountPtr,
		ConnectionURI:      pConnURIPtr,
		ComposeFileContent: pComposeContentPtr,
		ComposeFilePath:    pComposePathPtr,
		Repository:         req.Repository,
		Branch:             req.Branch,
		DockerfilePath:     req.DockerfilePath,
		InternalPort:       req.InternalPort,
		PublishedPort:      publishedPortPtr,
		HealthCheckPath:    req.HealthCheckPath,
		Status:             models.ServiceStopped,
		AutoDeploy:         autoDeploy,
		TriggerOnPush:      triggerOnPush,
		TriggerOnTag:       triggerOnTag,
		TagPattern:         &tagPattern,
		DeployKeyPublic:    pubKeyPtr,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	if generatedPassword != "" {
		service.DatabasePassword = &generatedPassword
	}

	if (serviceType == models.ServiceTypeWorker || serviceType == models.ServiceTypeCron || serviceType == models.ServiceTypeDatabase || serviceType == models.ServiceTypeCompose) && autoDeploy && h.orchestrator != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()
			_, _ = h.orchestrator.TriggerDeployment(ctx, id, nil)
		}()
	}

	audit.Record(r.Context(), "service.create", "service", id, map[string]string{"name": req.Name, "project_id": req.ProjectID})
	sendJSON(w, http.StatusCreated, service)
}

func (h *Handler) GetService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var s models.Service
	var pDom, actDep, pPubKey sql.NullString
	var createdAtStr, updatedAtStr string

	var sType string
	var pPubPort sql.NullInt64
	var pParentID, pCmd, pCronExpr sql.NullString
	var pDBEngine, pDBVersion, pDBName, pDBUser, pVolName, pVolMount, pConnURI sql.NullString
	var pPreDeploy, pPostDeploy sql.NullString
	var pComposeContent, pComposePath, pGHConnID sql.NullString
	var dbPassEnc, dbPassNonce []byte

	var pTagPattern sql.NullString
	err := h.db.QueryRow(`
		SELECT id, project_id, server_id, name, service_type, parent_service_id, command, cron_expression,
		       repository, branch, dockerfile_path, internal_port, published_port, health_check_path, status,
		       primary_domain, active_deployment_id, auto_deploy, trigger_on_push, trigger_on_tag, tag_pattern, deploy_key_public,
		       database_engine, database_version, database_name, database_user,
		       database_password_encrypted, database_password_nonce,
		       volume_name, volume_mount_path, connection_uri,
		       pre_deploy_command, post_deploy_command,
		       compose_file_content, compose_file_path,
		       github_connection_id,
		       created_at, updated_at
		FROM services WHERE id = ?
	`, id).Scan(
		&s.ID, &s.ProjectID, &s.ServerID, &s.Name, &sType, &pParentID, &pCmd, &pCronExpr,
		&s.Repository, &s.Branch, &s.DockerfilePath, &s.InternalPort, &pPubPort, &s.HealthCheckPath, &s.Status,
		&pDom, &actDep, &s.AutoDeploy, &s.TriggerOnPush, &s.TriggerOnTag, &pTagPattern, &pPubKey,
		&pDBEngine, &pDBVersion, &pDBName, &pDBUser,
		&dbPassEnc, &dbPassNonce,
		&pVolName, &pVolMount, &pConnURI,
		&pPreDeploy, &pPostDeploy,
		&pComposeContent, &pComposePath,
		&pGHConnID,
		&createdAtStr, &updatedAtStr,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if pTagPattern.Valid {
		s.TagPattern = &pTagPattern.String
	}

	if sType == "" {
		s.ServiceType = models.ServiceTypeWeb
	} else {
		s.ServiceType = models.ServiceType(sType)
	}
	if pPubPort.Valid {
		val := int(pPubPort.Int64)
		s.PublishedPort = &val
	}
	if pParentID.Valid {
		s.ParentServiceID = &pParentID.String
	}
	if pCmd.Valid {
		s.Command = &pCmd.String
	}
	if pCronExpr.Valid {
		s.CronExpression = &pCronExpr.String
	}
	if pPreDeploy.Valid {
		s.PreDeployCommand = &pPreDeploy.String
	}
	if pPostDeploy.Valid {
		s.PostDeployCommand = &pPostDeploy.String
	}
	if pComposeContent.Valid {
		s.ComposeFileContent = &pComposeContent.String
	}
	if pComposePath.Valid {
		s.ComposeFilePath = &pComposePath.String
	}
	if pDBEngine.Valid {
		s.DatabaseEngine = &pDBEngine.String
	}
	if pDBVersion.Valid {
		s.DatabaseVersion = &pDBVersion.String
	}
	if pDBName.Valid {
		s.DatabaseName = &pDBName.String
	}
	if pDBUser.Valid {
		s.DatabaseUser = &pDBUser.String
	}
	if len(dbPassEnc) > 0 && len(dbPassNonce) > 0 {
		decrypted, decErr := crypto.Decrypt(dbPassEnc, dbPassNonce, h.masterKey)
		if decErr == nil {
			decStr := string(decrypted)
			s.DatabasePassword = &decStr
		}
	}
	if pVolName.Valid {
		s.VolumeName = &pVolName.String
	}
	if pVolMount.Valid {
		s.VolumeMountPath = &pVolMount.String
	}
	if pConnURI.Valid {
		s.ConnectionURI = &pConnURI.String
	}

	if pDom.Valid {
		s.PrimaryDomain = &pDom.String
	}
	if actDep.Valid {
		s.ActiveDeploymentID = &actDep.String
	}
	if pPubKey.Valid {
		s.DeployKeyPublic = &pPubKey.String
	}
	if pGHConnID.Valid {
		s.GitHubConnectionID = &pGHConnID.String
	}
	s.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
	if s.CreatedAt.IsZero() {
		s.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
	}
	s.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)
	if s.UpdatedAt.IsZero() {
		s.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAtStr)
	}

	// Fetch Server
	var server models.Server
	var sHost sql.NullString
	var sCreatedStr, sUpdatedStr string
	_ = h.db.QueryRow(`
		SELECT id, name, host, status, agent_version, cpu_percent, ram_percent, disk_percent, created_at, updated_at
		FROM servers WHERE id = ?
	`, s.ServerID).Scan(
		&server.ID, &server.Name, &sHost, &server.Status, &server.AgentVersion,
		&server.CPUPercent, &server.RAMPercent, &server.DiskPercent,
		&sCreatedStr, &sUpdatedStr,
	)
	if sHost.Valid {
		server.Host = &sHost.String
	}

	// Fetch Project
	var project models.Project
	var pDesc sql.NullString
	var prjCreatedStr, prjUpdatedStr string
	_ = h.db.QueryRow(`
		SELECT id, name, description, created_at, updated_at
		FROM projects WHERE id = ?
	`, s.ProjectID).Scan(&project.ID, &project.Name, &pDesc, &prjCreatedStr, &prjUpdatedStr)
	if pDesc.Valid {
		project.Description = &pDesc.String
	}

	// Fetch Domains
	domRows, _ := h.db.Query(`
		SELECT d.id, d.service_id, s.name, d.domain, d.port, d.path_prefix, d.strip_prefix,
		       d.is_canonical, d.redirect_mode, d.auth_enabled, d.auth_user, d.entrypoints,
		       d.ssl_resolver, d.ssl_status, d.ssl_error, d.created_at
		FROM domains d
		LEFT JOIN services s ON d.service_id = s.id
		WHERE d.service_id = ?
		ORDER BY d.is_canonical DESC, d.created_at ASC
	`, id)
	domains := make([]models.Domain, 0)
	if domRows != nil {
		defer domRows.Close()
		for domRows.Next() {
			var d models.Domain
			var sName, sslErr sql.NullString
			var domCreatedStr string
			if err := domRows.Scan(
				&d.ID, &d.ServiceID, &sName, &d.Domain, &d.Port, &d.PathPrefix, &d.StripPrefix,
				&d.IsCanonical, &d.RedirectMode, &d.AuthEnabled, &d.AuthUser, &d.EntryPoints,
				&d.SSLResolver, &d.SSLStatus, &sslErr, &domCreatedStr,
			); err == nil {
				if sName.Valid {
					d.ServiceName = &sName.String
				}
				if sslErr.Valid {
					d.SSLError = &sslErr.String
				}
				d.CreatedAt, _ = time.Parse(time.RFC3339, domCreatedStr)
				if d.CreatedAt.IsZero() {
					d.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", domCreatedStr)
				}
				domains = append(domains, d)
			}
		}
	}

	// Fetch Active Deployment
	var activeDep *models.Deployment
	if s.ActiveDeploymentID != nil && *s.ActiveDeploymentID != "" {
		var dep models.Deployment
		var imgTag sql.NullString
		var depCreatedStr string
		err := h.db.QueryRow(`
			SELECT id, service_id, status, commit_sha, commit_message, commit_author, branch, image_tag, created_at
			FROM deployments WHERE id = ?
		`, *s.ActiveDeploymentID).Scan(
			&dep.ID, &dep.ServiceID, &dep.Status, &dep.CommitSHA, &dep.CommitMessage, &dep.CommitAuthor,
			&dep.Branch, &imgTag, &depCreatedStr,
		)
		if err == nil {
			if imgTag.Valid {
				dep.ImageTag = &imgTag.String
			}
			dep.CreatedAt, _ = time.Parse(time.RFC3339, depCreatedStr)
			activeDep = &dep
		}
	}

	var envCount int
	_ = h.db.QueryRow(`SELECT count(*) FROM env_vars WHERE service_id = ?`, id).Scan(&envCount)

	detail := models.ServiceDetail{
		Service:          s,
		Server:           &server,
		Project:          &project,
		Domains:          domains,
		ActiveDeployment: activeDep,
		EnvVarsCount:     envCount,
	}

	sendJSON(w, http.StatusOK, detail)
}

func (h *Handler) UpdateService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req models.UpdateServiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var s models.Service
	var sType string
	var pParentID, pCmd, pCronExpr, pDom, actDep, pPubKey, pTagPattern sql.NullString
	var pPreDeploy, pPostDeploy sql.NullString
	var pComposeContent, pComposePath, pGHConnID sql.NullString
	var createdAtStr, updatedAtStr string

	err := h.db.QueryRow(`
		SELECT id, project_id, server_id, name, service_type, parent_service_id, command, cron_expression,
		       repository, branch, dockerfile_path, internal_port, health_check_path, status,
		       primary_domain, active_deployment_id, auto_deploy, trigger_on_push, trigger_on_tag, tag_pattern, deploy_key_public,
		       pre_deploy_command, post_deploy_command,
		       compose_file_content, compose_file_path,
		       github_connection_id,
		       created_at, updated_at
		FROM services WHERE id = ?
	`, id).Scan(
		&s.ID, &s.ProjectID, &s.ServerID, &s.Name, &sType, &pParentID, &pCmd, &pCronExpr,
		&s.Repository, &s.Branch, &s.DockerfilePath, &s.InternalPort, &s.HealthCheckPath, &s.Status,
		&pDom, &actDep, &s.AutoDeploy, &s.TriggerOnPush, &s.TriggerOnTag, &pTagPattern, &pPubKey,
		&pPreDeploy, &pPostDeploy,
		&pComposeContent, &pComposePath,
		&pGHConnID,
		&createdAtStr, &updatedAtStr,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if pTagPattern.Valid {
		s.TagPattern = &pTagPattern.String
	}

	if sType == "" {
		s.ServiceType = models.ServiceTypeWeb
	} else {
		s.ServiceType = models.ServiceType(sType)
	}
	if pParentID.Valid {
		s.ParentServiceID = &pParentID.String
	}
	if pCmd.Valid {
		s.Command = &pCmd.String
	}
	if pCronExpr.Valid {
		s.CronExpression = &pCronExpr.String
	}
	if pPreDeploy.Valid {
		s.PreDeployCommand = &pPreDeploy.String
	}
	if pPostDeploy.Valid {
		s.PostDeployCommand = &pPostDeploy.String
	}
	if pComposeContent.Valid {
		s.ComposeFileContent = &pComposeContent.String
	}
	if pComposePath.Valid {
		s.ComposeFilePath = &pComposePath.String
	}
	if pDom.Valid {
		s.PrimaryDomain = &pDom.String
	}
	if actDep.Valid {
		s.ActiveDeploymentID = &actDep.String
	}
	if pPubKey.Valid {
		s.DeployKeyPublic = &pPubKey.String
	}
	if pGHConnID.Valid {
		s.GitHubConnectionID = &pGHConnID.String
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		s.Name = strings.TrimSpace(*req.Name)
	}
	if req.ServiceType != nil && strings.TrimSpace(string(*req.ServiceType)) != "" {
		s.ServiceType = *req.ServiceType
	}
	if req.Branch != nil && strings.TrimSpace(*req.Branch) != "" {
		s.Branch = strings.TrimSpace(*req.Branch)
	}
	if req.DockerfilePath != nil && strings.TrimSpace(*req.DockerfilePath) != "" {
		s.DockerfilePath = strings.TrimSpace(*req.DockerfilePath)
	}
	if req.InternalPort != nil && *req.InternalPort >= 0 {
		s.InternalPort = *req.InternalPort
	}
	if req.HealthCheckPath != nil {
		s.HealthCheckPath = strings.TrimSpace(*req.HealthCheckPath)
	}
	if req.ServerID != nil && strings.TrimSpace(*req.ServerID) != "" {
		s.ServerID = strings.TrimSpace(*req.ServerID)
	}
	if req.TriggerOnPush != nil {
		s.TriggerOnPush = *req.TriggerOnPush
		s.AutoDeploy = s.TriggerOnPush
	} else if req.AutoDeploy != nil {
		s.AutoDeploy = *req.AutoDeploy
		s.TriggerOnPush = s.AutoDeploy
	}
	if req.TriggerOnTag != nil {
		s.TriggerOnTag = *req.TriggerOnTag
	}
	if req.TagPattern != nil {
		tp := strings.TrimSpace(*req.TagPattern)
		if tp == "" {
			tp = "*"
		}
		s.TagPattern = &tp
	}
	if req.Command != nil {
		c := strings.TrimSpace(*req.Command)
		s.Command = &c
	}
	if req.CronExpression != nil {
		ce := strings.TrimSpace(*req.CronExpression)
		s.CronExpression = &ce
	}
	if req.PreDeployCommand != nil {
		pd := strings.TrimSpace(*req.PreDeployCommand)
		s.PreDeployCommand = &pd
	}
	if req.PostDeployCommand != nil {
		pd := strings.TrimSpace(*req.PostDeployCommand)
		s.PostDeployCommand = &pd
	}
	if req.ComposeFileContent != nil {
		if strings.TrimSpace(*req.ComposeFileContent) != "" {
			_, valRes := compose.ParseAndValidate(*req.ComposeFileContent)
			if !valRes.Valid {
				sendError(w, http.StatusBadRequest, fmt.Sprintf("Invalid Compose YAML: %s", strings.Join(valRes.Errors, "; ")))
				return
			}
			s.ComposeFileContent = req.ComposeFileContent
		} else {
			s.ComposeFileContent = nil
		}
	}
	if req.ComposeFilePath != nil {
		p := strings.TrimSpace(*req.ComposeFilePath)
		if p != "" {
			s.ComposeFilePath = &p
		}
	}

	if req.VolumeName != nil {
		vn := strings.TrimSpace(*req.VolumeName)
		s.VolumeName = &vn
	}
	if req.VolumeMountPath != nil {
		vmp := strings.TrimSpace(*req.VolumeMountPath)
		s.VolumeMountPath = &vmp
	}
	if req.PublishedPort != nil {
		if *req.PublishedPort > 0 {
			p := *req.PublishedPort
			s.PublishedPort = &p
		} else {
			s.PublishedPort = nil
		}
	}

	if req.GitHubConnectionID != nil {
		s.GitHubConnectionID = req.GitHubConnectionID
	}

	tagPatternVal := "*"
	if s.TagPattern != nil && *s.TagPattern != "" {
		tagPatternVal = *s.TagPattern
	}

	_, err = h.db.Exec(`
		UPDATE services SET
			name = ?, service_type = ?, branch = ?, dockerfile_path = ?, internal_port = ?, published_port = ?,
			health_check_path = ?, server_id = ?, auto_deploy = ?, trigger_on_push = ?, trigger_on_tag = ?, tag_pattern = ?,
			command = ?, cron_expression = ?, pre_deploy_command = ?, post_deploy_command = ?,
			volume_name = ?, volume_mount_path = ?, compose_file_content = ?, compose_file_path = ?,
			github_connection_id = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, s.Name, s.ServiceType, s.Branch, s.DockerfilePath, s.InternalPort, s.PublishedPort, s.HealthCheckPath, s.ServerID, s.AutoDeploy,
		s.TriggerOnPush, s.TriggerOnTag, tagPatternVal,
		s.Command, s.CronExpression, s.PreDeployCommand, s.PostDeployCommand,
		s.VolumeName, s.VolumeMountPath, s.ComposeFileContent, s.ComposeFilePath,
		s.GitHubConnectionID, id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to update service")
		return
	}

	audit.Record(r.Context(), "service.update", "service", id, map[string]string{"name": s.Name})
	sendJSON(w, http.StatusOK, s)
}

func (h *Handler) DeleteService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	deleteVolumes := r.URL.Query().Get("delete_volumes") == "true"
	pruneImages := r.URL.Query().Get("prune_images") == "true"

	s, _ := h.getServiceByID(id)

	if s != nil && h.nodeManager != nil && s.ServerID != "" {
		_ = h.nodeManager.SendCommand(r.Context(), s.ServerID, &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_ContainerAction{
				ContainerAction: &protocol.ContainerAction{
					TaskId:        generateID("act"),
					ServiceId:     s.ID,
					Action:        "delete",
					DeleteVolumes: deleteVolumes,
					PruneImages:   pruneImages,
				},
			},
		})
	}

	res, err := h.db.Exec(`DELETE FROM services WHERE id = ?`, id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to delete service")
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		sendError(w, http.StatusNotFound, "Service not found")
		return
	}

	audit.Record(r.Context(), "service.delete", "service", id, map[string]any{
		"delete_volumes": deleteVolumes,
		"prune_images":   pruneImages,
	})
	sendJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Service deleted successfully",
	})
}

func (h *Handler) getServiceByID(id string) (*models.Service, error) {
	var s models.Service
	var sType string
	var pPubPort sql.NullInt64
	var pParentID, pCmd, pCronExpr, pDom, actDep, pPubKey sql.NullString
	var pPreDeploy, pPostDeploy sql.NullString
	var pDBEngine, pDBVersion, pDBName, pDBUser, pVolName, pVolMount, pConnURI sql.NullString
	var pComposeContent, pComposePath, pGHConnID sql.NullString
	var dbPassEnc, dbPassNonce []byte
	var createdAtStr, updatedAtStr string

	var pTagPattern sql.NullString
	err := h.db.QueryRow(`
		SELECT id, project_id, server_id, name, service_type, parent_service_id, command, cron_expression,
		       repository, branch, dockerfile_path, internal_port, published_port, health_check_path, status,
		       primary_domain, active_deployment_id, auto_deploy, trigger_on_push, trigger_on_tag, tag_pattern, deploy_key_public,
		       database_engine, database_version, database_name, database_user,
		       database_password_encrypted, database_password_nonce,
		       volume_name, volume_mount_path, connection_uri,
		       pre_deploy_command, post_deploy_command,
		       compose_file_content, compose_file_path,
		       github_connection_id,
		       created_at, updated_at
		FROM services WHERE id = ?
	`, id).Scan(
		&s.ID, &s.ProjectID, &s.ServerID, &s.Name, &sType, &pParentID, &pCmd, &pCronExpr,
		&s.Repository, &s.Branch, &s.DockerfilePath, &s.InternalPort, &pPubPort, &s.HealthCheckPath, &s.Status,
		&pDom, &actDep, &s.AutoDeploy, &s.TriggerOnPush, &s.TriggerOnTag, &pTagPattern, &pPubKey,
		&pDBEngine, &pDBVersion, &pDBName, &pDBUser,
		&dbPassEnc, &dbPassNonce,
		&pVolName, &pVolMount, &pConnURI,
		&pPreDeploy, &pPostDeploy,
		&pComposeContent, &pComposePath,
		&pGHConnID,
		&createdAtStr, &updatedAtStr,
	)
	if err != nil {
		return nil, err
	}

	if pTagPattern.Valid {
		s.TagPattern = &pTagPattern.String
	}

	if sType == "" {
		s.ServiceType = models.ServiceTypeWeb
	} else {
		s.ServiceType = models.ServiceType(sType)
	}
	if pPubPort.Valid {
		val := int(pPubPort.Int64)
		s.PublishedPort = &val
	}
	if pParentID.Valid {
		s.ParentServiceID = &pParentID.String
	}
	if pCmd.Valid {
		s.Command = &pCmd.String
	}
	if pCronExpr.Valid {
		s.CronExpression = &pCronExpr.String
	}
	if pPreDeploy.Valid {
		s.PreDeployCommand = &pPreDeploy.String
	}
	if pPostDeploy.Valid {
		s.PostDeployCommand = &pPostDeploy.String
	}
	if pComposeContent.Valid {
		s.ComposeFileContent = &pComposeContent.String
	}
	if pComposePath.Valid {
		s.ComposeFilePath = &pComposePath.String
	}
	if pGHConnID.Valid {
		s.GitHubConnectionID = &pGHConnID.String
	}
	if pDBEngine.Valid {
		s.DatabaseEngine = &pDBEngine.String
	}
	if pDBVersion.Valid {
		s.DatabaseVersion = &pDBVersion.String
	}
	if pDBName.Valid {
		s.DatabaseName = &pDBName.String
	}
	if pDBUser.Valid {
		s.DatabaseUser = &pDBUser.String
	}
	if len(dbPassEnc) > 0 && len(dbPassNonce) > 0 {
		decrypted, decErr := crypto.Decrypt(dbPassEnc, dbPassNonce, h.masterKey)
		if decErr == nil {
			decStr := string(decrypted)
			s.DatabasePassword = &decStr
		}
	}
	if pVolName.Valid {
		s.VolumeName = &pVolName.String
	}
	if pVolMount.Valid {
		s.VolumeMountPath = &pVolMount.String
	}
	if pConnURI.Valid {
		s.ConnectionURI = &pConnURI.String
	}

	if pDom.Valid {
		s.PrimaryDomain = &pDom.String
	}
	if actDep.Valid {
		s.ActiveDeploymentID = &actDep.String
	}
	if pPubKey.Valid {
		s.DeployKeyPublic = &pPubKey.String
	}
	s.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
	if s.CreatedAt.IsZero() {
		s.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
	}
	s.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)
	if s.UpdatedAt.IsZero() {
		s.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAtStr)
	}
	return &s, nil
}

func (h *Handler) StartService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, err := h.getServiceByID(id)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	_, _ = h.db.Exec(`UPDATE services SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
	s.Status = models.ServiceRunning
	s.UpdatedAt = time.Now()

	if h.nodeManager != nil && s.ServerID != "" {
		_ = h.nodeManager.SendCommand(r.Context(), s.ServerID, &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_ContainerAction{
				ContainerAction: &protocol.ContainerAction{
					TaskId:    generateID("act"),
					ServiceId: s.ID,
					Action:    "start",
				},
			},
		})
	}

	sendJSON(w, http.StatusOK, s)
}

func (h *Handler) StopService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, err := h.getServiceByID(id)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	_, _ = h.db.Exec(`UPDATE services SET status = 'stopped', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
	s.Status = models.ServiceStopped
	s.UpdatedAt = time.Now()

	if h.nodeManager != nil && s.ServerID != "" {
		_ = h.nodeManager.SendCommand(r.Context(), s.ServerID, &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_ContainerAction{
				ContainerAction: &protocol.ContainerAction{
					TaskId:    generateID("act"),
					ServiceId: s.ID,
					Action:    "stop",
				},
			},
		})
	}

	sendJSON(w, http.StatusOK, s)
}

func (h *Handler) RestartService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, err := h.getServiceByID(id)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	_, _ = h.db.Exec(`UPDATE services SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
	s.Status = models.ServiceRunning
	s.UpdatedAt = time.Now()

	if h.nodeManager != nil && s.ServerID != "" {
		_ = h.nodeManager.SendCommand(r.Context(), s.ServerID, &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_ContainerAction{
				ContainerAction: &protocol.ContainerAction{
					TaskId:    generateID("act"),
					ServiceId: s.ID,
					Action:    "restart",
				},
			},
		})
	}

	sendJSON(w, http.StatusOK, s)
}

func (h *Handler) RebuildService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req models.RebuildRequest
	if r.Body != nil && r.ContentLength > 0 {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}

	s, err := h.getServiceByID(id)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	branch := s.Branch
	if req.Branch != nil && *req.Branch != "" {
		branch = *req.Branch
	}

	createDepReq := &models.CreateDeploymentRequest{
		Branch:    &branch,
		CommitSHA: req.CommitSHA,
	}

	if h.orchestrator != nil {
		dep, err := h.orchestrator.TriggerDeployment(r.Context(), id, createDepReq)
		if err != nil {
			sendError(w, http.StatusBadRequest, err.Error())
			return
		}
		sendJSON(w, http.StatusAccepted, dep)
		return
	}

	depID := generateID("dep")
	now := time.Now()
	commitSHA := ""
	if req.CommitSHA != nil {
		commitSHA = *req.CommitSHA
	}
	_, _ = h.db.Exec(`
		INSERT INTO deployments (id, service_id, status, branch, commit_sha, commit_message, commit_author, created_at)
		VALUES (?, ?, 'queued', ?, ?, 'Manual rebuild', 'Admin', CURRENT_TIMESTAMP)
	`, depID, id, branch, commitSHA)

	sendJSON(w, http.StatusAccepted, models.Deployment{
		ID:            depID,
		ServiceID:     id,
		Status:        models.DeploymentQueued,
		Branch:        branch,
		CommitSHA:     commitSHA,
		CommitMessage: "Manual rebuild",
		CommitAuthor:  "Admin",
		CreatedAt:     now,
	})
}

func (h *Handler) RedeployService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	s, err := h.getServiceByID(id)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	branch := s.Branch
	if branch == "" {
		branch = "main"
	}

	createDepReq := &models.CreateDeploymentRequest{
		Branch: &branch,
	}

	if h.orchestrator != nil {
		dep, err := h.orchestrator.TriggerDeployment(r.Context(), id, createDepReq)
		if err != nil {
			sendError(w, http.StatusBadRequest, err.Error())
			return
		}
		audit.Record(r.Context(), "service.redeploy", "service", id, map[string]any{
			"deployment_id": dep.ID,
			"branch":        branch,
		})
		sendJSON(w, http.StatusAccepted, dep)
		return
	}

	depID := generateID("dep")
	now := time.Now()
	_, _ = h.db.Exec(`
		INSERT INTO deployments (id, service_id, status, branch, commit_sha, commit_message, commit_author, created_at)
		VALUES (?, ?, 'queued', ?, '', 'Automated redeploy', 'Admin', CURRENT_TIMESTAMP)
	`, depID, id, branch)

	audit.Record(r.Context(), "service.redeploy", "service", id, map[string]any{
		"deployment_id": depID,
		"branch":        branch,
	})

	sendJSON(w, http.StatusAccepted, models.Deployment{
		ID:            depID,
		ServiceID:     id,
		Status:        models.DeploymentQueued,
		Branch:        branch,
		CommitSHA:     "",
		CommitMessage: "Automated redeploy",
		CommitAuthor:  "Admin",
		CreatedAt:     now,
	})
}

func (h *Handler) PullUpdateService(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	s, err := h.getServiceByID(id)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	imageTag := ""
	if s.ServiceType == models.ServiceTypeDatabase {
		engine := "postgres"
		if s.DatabaseEngine != nil && *s.DatabaseEngine != "" {
			engine = *s.DatabaseEngine
		}
		version := "16-alpine"
		if s.DatabaseVersion != nil && *s.DatabaseVersion != "" {
			version = *s.DatabaseVersion
		}
		if strings.Contains(version, ":") {
			imageTag = version
		} else {
			imageTag = fmt.Sprintf("%s:%s", engine, version)
		}
	} else if s.DockerfilePath != "" && !strings.Contains(s.DockerfilePath, "Dockerfile") {
		imageTag = s.DockerfilePath
	}

	if imageTag == "" && s.ServiceType != models.ServiceTypeDatabase {
		sendError(w, http.StatusBadRequest, "Pull update is only supported for image-based or database services")
		return
	}

	taskID := generateID("act")
	if h.nodeManager != nil && s.ServerID != "" {
		ack, err := h.nodeManager.SendTaskWithResponse(r.Context(), s.ServerID, taskID, &protocol.ServerMessage{
			Payload: &protocol.ServerMessage_ContainerAction{
				ContainerAction: &protocol.ContainerAction{
					TaskId:    taskID,
					ServiceId: s.ID,
					Action:    "pull-update",
					Image:     imageTag,
				},
			},
		})
		if err != nil {
			sendError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to execute pull update on agent: %v", err))
			return
		}
		if !ack.Success {
			sendError(w, http.StatusInternalServerError, ack.Message)
			return
		}

		isUpToDate := strings.Contains(strings.ToLower(ack.Message), "already up to date")
		audit.Record(r.Context(), "service.pull_update", "service", id, map[string]any{
			"image":   imageTag,
			"updated": !isUpToDate,
			"message": ack.Message,
		})

		sendJSON(w, http.StatusOK, map[string]any{
			"updated": !isUpToDate,
			"message": ack.Message,
		})
		return
	}

	audit.Record(r.Context(), "service.pull_update", "service", id, map[string]any{
		"image":   imageTag,
		"updated": true,
	})
	sendJSON(w, http.StatusOK, map[string]any{
		"updated": true,
		"message": "Container recreated with latest image",
	})
}

func (h *Handler) StreamRuntimeLogs(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, err := h.getServiceByID(id)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		sendError(w, http.StatusInternalServerError, "Streaming unsupported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	containerID := "tako-" + s.ID
	initEvent := models.ContainerLogEvent{
		ContainerID: containerID,
		Stream:      "stdout",
		Line:        fmt.Sprintf("Connected to runtime log stream for service %s", s.Name),
		Timestamp:   time.Now().UTC(),
	}
	data, _ := json.Marshal(initEvent)
	_, _ = fmt.Fprintf(w, "data: %s\n\n", string(data))
	flusher.Flush()

	follow := r.URL.Query().Get("follow")
	containerFilter := r.URL.Query().Get("container")
	if follow == "false" {
		return
	}

	if h.orchestrator != nil {
		logCh, cleanup, err := h.orchestrator.SubscribeRuntimeLogs(id)
		if err == nil {
			defer cleanup()
			for {
				select {
				case <-r.Context().Done():
					return
				case evt, ok := <-logCh:
					if !ok {
						return
					}
					if containerFilter != "" && evt.ContainerName != "" && evt.ContainerName != containerFilter {
						continue
					}
					data, err := json.Marshal(evt)
					if err == nil {
						_, _ = fmt.Fprintf(w, "data: %s\n\n", string(data))
						flusher.Flush()
					}
				}
			}
		}
	}

	<-r.Context().Done()
}

func (h *Handler) StreamServiceStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, err := h.getServiceByID(id)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		sendError(w, http.StatusInternalServerError, "Streaming unsupported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	var uptime int64 = 0
	if s.Status == models.ServiceRunning {
		uptime = 3600
	}
	statusEvt := models.ServiceStatusEvent{
		ServiceID:          s.ID,
		Status:             s.Status,
		ActiveDeploymentID: s.ActiveDeploymentID,
		UptimeSeconds:      &uptime,
	}
	data, _ := json.Marshal(statusEvt)
	_, _ = fmt.Fprintf(w, "data: %s\n\n", string(data))
	flusher.Flush()

	<-r.Context().Done()
}

func (h *Handler) InjectConnectionString(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	dbService, err := h.getServiceByID(id)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Database service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if dbService.ConnectionURI == nil || strings.TrimSpace(*dbService.ConnectionURI) == "" {
		sendError(w, http.StatusBadRequest, "Service does not have a connection URI")
		return
	}

	var req models.InjectConnectionStringRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if strings.TrimSpace(req.TargetServiceID) == "" {
		sendError(w, http.StatusBadRequest, "target_service_id is required")
		return
	}

	targetService, err := h.getServiceByID(req.TargetServiceID)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Target service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if targetService.ProjectID != dbService.ProjectID {
		sendError(w, http.StatusBadRequest, "Target service must belong to the same project")
		return
	}

	envKey := strings.TrimSpace(req.EnvKey)
	if envKey == "" {
		if dbService.DatabaseEngine != nil && *dbService.DatabaseEngine == "redis" {
			envKey = "REDIS_URL"
		} else {
			envKey = "DATABASE_URL"
		}
	}

	encVal, nonce, err := crypto.Encrypt([]byte(*dbService.ConnectionURI), h.masterKey)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to encrypt connection URI")
		return
	}

	// Check if env var already exists for this target service
	var existingID string
	err = h.db.QueryRow(`SELECT id FROM env_vars WHERE service_id = ? AND key = ?`, targetService.ID, envKey).Scan(&existingID)
	if err == nil {
		_, err = h.db.Exec(`
			UPDATE env_vars
			SET value_encrypted = ?, nonce = ?, is_secret = 1, updated_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, encVal, nonce, existingID)
	} else {
		newID := generateID("env")
		_, err = h.db.Exec(`
			INSERT INTO env_vars (id, service_id, type, key, value_encrypted, nonce, is_secret, created_at, updated_at)
			VALUES (?, ?, 'env', ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, newID, targetService.ID, envKey, encVal, nonce)
	}

	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to save environment variable")
		return
	}

	sendJSON(w, http.StatusOK, map[string]any{
		"success":           true,
		"target_service_id": targetService.ID,
		"env_key":           envKey,
		"message":           "Connection string injected successfully",
	})
}

func (h *Handler) ValidateCompose(w http.ResponseWriter, r *http.Request) {
	var req models.ValidateComposeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	_, valRes := compose.ParseAndValidate(req.ComposeContent)
	summaries := make([]models.ComposeSubServiceSummary, 0, len(valRes.Services))
	for _, s := range valRes.Services {
		ports := make([]string, 0, len(s.Ports))
		for _, p := range s.Ports {
			if p.HostPort > 0 {
				ports = append(ports, fmt.Sprintf("%d:%d", p.HostPort, p.ContainerPort))
			} else {
				ports = append(ports, fmt.Sprintf("%d", p.ContainerPort))
			}
		}
		summaries = append(summaries, models.ComposeSubServiceSummary{
			Name:        s.Name,
			Image:       s.Image,
			Ports:       ports,
			Environment: s.Environment,
			DependsOn:   s.DependsOn,
		})
	}

	sendJSON(w, http.StatusOK, models.ValidateComposeResponse{
		Valid:    valRes.Valid,
		Services: summaries,
		Errors:   valRes.Errors,
	})
}

func (h *Handler) GetStackOverview(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s, err := h.getServiceByID(id)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Service not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if s.ServiceType != models.ServiceTypeCompose {
		sendError(w, http.StatusBadRequest, "Service is not a Docker Compose stack")
		return
	}

	composeContent := ""
	if s.ComposeFileContent != nil {
		composeContent = *s.ComposeFileContent
	}
	composePath := "docker-compose.yml"
	if s.ComposeFilePath != nil && *s.ComposeFilePath != "" {
		composePath = *s.ComposeFilePath
	}

	networkName := fmt.Sprintf("tako_compose_%s", s.ProjectID)

	var subServices []models.ComposeSubService
	if composeContent != "" {
		_, valRes := compose.ParseAndValidate(composeContent)
		for _, sc := range valRes.Services {
			var ports []string
			for _, p := range sc.Ports {
				if p.HostPort > 0 {
					ports = append(ports, fmt.Sprintf("%d:%d", p.HostPort, p.ContainerPort))
				} else {
					ports = append(ports, fmt.Sprintf("%d", p.ContainerPort))
				}
			}
			status := string(s.Status)
			if status == "" {
				status = "running"
			}
			subServices = append(subServices, models.ComposeSubService{
				Name:        sc.Name,
				Image:       sc.Image,
				ContainerID: fmt.Sprintf("tako-%s-%s", s.ID, sc.Name),
				Status:      status,
				Ports:       ports,
				Environment: sc.Environment,
			})
		}
	} else {
		subServices = append(subServices, models.ComposeSubService{
			Name:        "web",
			Image:       s.Repository,
			ContainerID: fmt.Sprintf("tako-%s-web", s.ID),
			Status:      string(s.Status),
			Ports:       []string{fmt.Sprintf("%d:%d", s.InternalPort, s.InternalPort)},
			Environment: make(map[string]string),
		})
	}

	sendJSON(w, http.StatusOK, models.ComposeStackOverview{
		ServiceID:      s.ID,
		ProjectID:      s.ProjectID,
		NetworkName:    networkName,
		ComposeContent: composeContent,
		ComposePath:    composePath,
		SubServices:    subServices,
	})
}

func (h *Handler) HandleServiceWebhook(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	s, err := h.getServiceByID(serviceID)
	if err != nil || s == nil {
		sendError(w, http.StatusNotFound, "Service not found")
		return
	}

	event := r.Header.Get("X-GitHub-Event")
	if event == "ping" {
		sendJSON(w, http.StatusOK, models.WebhookResponse{Received: true})
		return
	}

	bodyBytes, _ := io.ReadAll(r.Body)

	var commitSHA, commitMsg, commitAuthor string
	targetRef := s.Branch
	triggerType := "webhook"

	if len(bodyBytes) > 0 {
		var payload struct {
			Ref        string `json:"ref"`
			After      string `json:"after"`
			Deleted    bool   `json:"deleted"`
			HeadCommit struct {
				ID      string `json:"id"`
				Message string `json:"message"`
				Author  struct {
					Name string `json:"name"`
				} `json:"author"`
			} `json:"head_commit"`
		}

		if err := json.Unmarshal(bodyBytes, &payload); err == nil && payload.Ref != "" {
			if payload.Deleted {
				f := false
				sendJSON(w, http.StatusOK, models.WebhookResponse{
					Received:            true,
					DeploymentTriggered: &f,
				})
				return
			}

			commitSHA = payload.HeadCommit.ID
			if commitSHA == "" {
				commitSHA = payload.After
			}
			commitMsg = payload.HeadCommit.Message
			commitAuthor = payload.HeadCommit.Author.Name

			if strings.Contains(commitMsg, "[skip deploy]") || strings.Contains(commitMsg, "[skip ci]") {
				slog.Info("skipping deployment due to commit message flag",
					slog.String("service_id", s.ID),
					slog.String("commit_sha", commitSHA),
					slog.String("message", commitMsg),
				)
				f := false
				sendJSON(w, http.StatusOK, models.WebhookResponse{
					Received:            true,
					DeploymentTriggered: &f,
				})
				return
			}

			ref := payload.Ref
			if strings.HasPrefix(ref, "refs/tags/") {
				tagName := strings.TrimPrefix(ref, "refs/tags/")
				if !s.TriggerOnTag {
					slog.Info("ignoring tag push: trigger_on_tag is disabled for service",
						slog.String("service_id", s.ID),
						slog.String("tag", tagName),
					)
					f := false
					sendJSON(w, http.StatusOK, models.WebhookResponse{
						Received:            true,
						DeploymentTriggered: &f,
					})
					return
				}

				pattern := "*"
				if s.TagPattern != nil && *s.TagPattern != "" {
					pattern = *s.TagPattern
				}
				if !matchTag(pattern, tagName) {
					slog.Info("ignoring tag push: tag does not match configured tag_pattern",
						slog.String("service_id", s.ID),
						slog.String("tag", tagName),
						slog.String("pattern", pattern),
					)
					f := false
					sendJSON(w, http.StatusOK, models.WebhookResponse{
						Received:            true,
						DeploymentTriggered: &f,
					})
					return
				}

				targetRef = tagName
				triggerType = "tag"
			} else {
				branch := strings.TrimPrefix(ref, "refs/heads/")
				if !s.TriggerOnPush && !s.AutoDeploy {
					slog.Info("ignoring branch push: trigger_on_push is disabled for service",
						slog.String("service_id", s.ID),
						slog.String("branch", branch),
					)
					f := false
					sendJSON(w, http.StatusOK, models.WebhookResponse{
						Received:            true,
						DeploymentTriggered: &f,
					})
					return
				}

				if s.Branch != "" && branch != s.Branch {
					slog.Info("ignoring branch push: pushed branch does not match service configured branch",
						slog.String("service_id", s.ID),
						slog.String("pushed_branch", branch),
						slog.String("service_branch", s.Branch),
					)
					f := false
					sendJSON(w, http.StatusOK, models.WebhookResponse{
						Received:            true,
						DeploymentTriggered: &f,
					})
					return
				}

				targetRef = branch
				triggerType = "push"
			}
		}
	}

	if h.orchestrator != nil {
		req := &models.CreateDeploymentRequest{
			Branch:        &targetRef,
			CommitSHA:     &commitSHA,
			CommitMessage: &commitMsg,
			CommitAuthor:  &commitAuthor,
			TriggerType:   &triggerType,
		}
		_, depErr := h.orchestrator.TriggerDeployment(r.Context(), s.ID, req)
		if depErr != nil {
			slog.Error("failed to trigger service webhook deployment",
				slog.String("service_id", s.ID),
				slog.String("error", depErr.Error()),
			)
			sendError(w, http.StatusInternalServerError, "Failed to trigger deployment: "+depErr.Error())
			return
		}
	}

	t := true
	sendJSON(w, http.StatusOK, models.WebhookResponse{
		Received:            true,
		DeploymentTriggered: &t,
		ServiceID:           &s.ID,
	})
}
