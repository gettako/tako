package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/server/audit"
)

func (h *Handler) ListProjects(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT p.id, p.name, p.description, COUNT(s.id) as services_count, p.created_at, p.updated_at
		FROM projects p
		LEFT JOIN services s ON s.project_id = p.id
		GROUP BY p.id
		ORDER BY p.created_at DESC
	`
	rows, err := h.db.Query(query)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to query projects")
		return
	}
	defer rows.Close()

	projects := make([]models.Project, 0)
	for rows.Next() {
		var p models.Project
		var desc sql.NullString
		var createdAtStr, updatedAtStr string

		if err := rows.Scan(&p.ID, &p.Name, &desc, &p.ServicesCount, &createdAtStr, &updatedAtStr); err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to read project row")
			return
		}

		if desc.Valid {
			p.Description = &desc.String
		}
		p.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
		if p.CreatedAt.IsZero() {
			p.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
		}
		p.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)
		if p.UpdatedAt.IsZero() {
			p.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAtStr)
		}
		projects = append(projects, p)
	}

	sendJSON(w, http.StatusOK, projects)
}

func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request) {
	var req models.CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		sendError(w, http.StatusBadRequest, "Project name is required")
		return
	}

	id := generateID("prj")
	now := time.Now()

	_, err := h.db.Exec(`
		INSERT INTO projects (id, name, description, created_at, updated_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, id, req.Name, req.Description)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to create project")
		return
	}

	project := models.Project{
		ID:            id,
		Name:          req.Name,
		Description:   req.Description,
		ServicesCount: 0,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	audit.Record(r.Context(), "project.create", "project", id, map[string]string{"name": req.Name})
	sendJSON(w, http.StatusCreated, project)
}

func (h *Handler) GetProject(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var p models.Project
	var desc sql.NullString
	var createdAtStr, updatedAtStr string

	err := h.db.QueryRow(`
		SELECT id, name, description, created_at, updated_at
		FROM projects WHERE id = ?
	`, id).Scan(&p.ID, &p.Name, &desc, &createdAtStr, &updatedAtStr)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Project not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if desc.Valid {
		p.Description = &desc.String
	}
	p.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
	if p.CreatedAt.IsZero() {
		p.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
	}
	p.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)
	if p.UpdatedAt.IsZero() {
		p.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAtStr)
	}

	// Fetch services
	sRows, err := h.db.Query(`
		SELECT id, project_id, server_id, name, service_type, parent_service_id, command, cron_expression,
		       repository, branch, dockerfile_path, internal_port, published_port, health_check_path, status,
		       primary_domain, active_deployment_id, auto_deploy, deploy_key_public,
		       database_engine, database_version, database_name, database_user,
		       volume_name, volume_mount_path, connection_uri,
		       created_at, updated_at
		FROM services WHERE project_id = ?
		ORDER BY created_at DESC
	`, id)
	services := make([]models.Service, 0)
	if err == nil {
		defer sRows.Close()
		for sRows.Next() {
			var s models.Service
			var sType string
			var pPubPort sql.NullInt64
			var pParentID, pCmd, pCronExpr, pDom, actDep, pPubKey sql.NullString
			var pDBEngine, pDBVersion, pDBName, pDBUser, pVolName, pVolMount, pConnURI sql.NullString
			var sCreatedStr, sUpdatedStr string

			if err := sRows.Scan(
				&s.ID, &s.ProjectID, &s.ServerID, &s.Name, &sType, &pParentID, &pCmd, &pCronExpr,
				&s.Repository, &s.Branch, &s.DockerfilePath, &s.InternalPort, &pPubPort, &s.HealthCheckPath, &s.Status,
				&pDom, &actDep, &s.AutoDeploy, &pPubKey,
				&pDBEngine, &pDBVersion, &pDBName, &pDBUser,
				&pVolName, &pVolMount, &pConnURI,
				&sCreatedStr, &sUpdatedStr,
			); err == nil {
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
				if pDom.Valid {
					s.PrimaryDomain = &pDom.String
				}
				if actDep.Valid {
					s.ActiveDeploymentID = &actDep.String
				}
				if pPubKey.Valid {
					s.DeployKeyPublic = &pPubKey.String
				}
				s.CreatedAt, _ = time.Parse(time.RFC3339, sCreatedStr)
				if s.CreatedAt.IsZero() {
					s.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", sCreatedStr)
				}
				s.UpdatedAt, _ = time.Parse(time.RFC3339, sUpdatedStr)
				if s.UpdatedAt.IsZero() {
					s.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", sUpdatedStr)
				}
				services = append(services, s)
			}
		}
	}

	p.ServicesCount = len(services)
	detail := models.ProjectDetail{
		Project:  p,
		Services: services,
	}
	sendJSON(w, http.StatusOK, detail)
}

func (h *Handler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req models.UpdateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var p models.Project
	var desc sql.NullString
	var createdAtStr, updatedAtStr string

	err := h.db.QueryRow(`
		SELECT id, name, description, created_at, updated_at
		FROM projects WHERE id = ?
	`, id).Scan(&p.ID, &p.Name, &desc, &createdAtStr, &updatedAtStr)
	if err != nil {
		if err == sql.ErrNoRows {
			sendError(w, http.StatusNotFound, "Project not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Database error")
		return
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		p.Name = strings.TrimSpace(*req.Name)
	}
	if req.Description != nil {
		p.Description = req.Description
	}

	_, err = h.db.Exec(`
		UPDATE projects SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, p.Name, p.Description, id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to update project")
		return
	}

	_ = h.db.QueryRow(`SELECT count(*) FROM services WHERE project_id = ?`, id).Scan(&p.ServicesCount)
	audit.Record(r.Context(), "project.update", "project", id, map[string]string{"name": p.Name})
	sendJSON(w, http.StatusOK, p)
}

func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	res, err := h.db.Exec(`DELETE FROM projects WHERE id = ?`, id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to delete project")
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		sendError(w, http.StatusNotFound, "Project not found")
		return
	}

	audit.Record(r.Context(), "project.delete", "project", id, nil)
	sendJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Project deleted successfully",
	})
}
