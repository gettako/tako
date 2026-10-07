package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

type CreateServiceRequest struct {
	ProjectID       string            `json:"projectId"`
	NodeID          string            `json:"nodeId"`
	Name            string            `json:"name"`
	Slug            string            `json:"slug"`
	Type            string            `json:"type"`
	Repository      string            `json:"repository"`
	Branch          string            `json:"branch"`
	Dockerfile      string            `json:"dockerfile"`
	Image           string            `json:"image"`
	Ports           []int32           `json:"ports"`
	Domains         []string          `json:"domains"`
	EnvironmentVars map[string]string `json:"environmentVars"`
	PublishToHost   *bool             `json:"publishToHost,omitempty"`
}

type ServiceLimitsResponse struct {
	CPUCores float64 `json:"cpuCores"`
	MemoryMB int64   `json:"memoryMb"`
	DiskGB   float64 `json:"diskGb,omitempty"`
	SwapMB   int64   `json:"swapMb,omitempty"`
}

type ServiceDomainResponse struct {
	ID              string `json:"id"`
	Domain          string `json:"domain"`
	SSL             bool   `json:"ssl"`
	Primary         bool   `json:"primary"`
	Port            int64  `json:"port"`
	Path            string `json:"path"`
	CertificateType string `json:"certificateType"`
	CreatedAt       string `json:"createdAt"`
}

type ServiceEnvVarResponse struct {
	ID       string `json:"id"`
	Key      string `json:"key"`
	Value    string `json:"value"`
	IsSecret bool   `json:"isSecret"`
}

type ServiceResponse struct {
	ID               string                  `json:"id"`
	ProjectID        string                  `json:"projectId"`
	NodeID           string                  `json:"nodeId"`
	NodeName         string                  `json:"nodeName,omitempty"`
	Name             string                  `json:"name"`
	Slug             string                  `json:"slug"`
	Type             string                  `json:"type"`
	Status           string                  `json:"status"`
	Repository       string                  `json:"repository,omitempty"`
	Branch           string                  `json:"branch,omitempty"`
	CommitHash       string                  `json:"commitHash,omitempty"`
	Dockerfile       string                  `json:"dockerfile,omitempty"`
	BuildCommand     string                  `json:"buildCommand,omitempty"`
	ComposeFile      string                  `json:"composeFile,omitempty"`
	Image            string                  `json:"image,omitempty"`
	DatabaseType     string                  `json:"databaseType,omitempty"`
	DatabaseVersion  string                  `json:"databaseVersion,omitempty"`
	ConnectionString string                  `json:"connectionString,omitempty"`
	Ports            []int32                 `json:"ports"`
	Domains          []string                `json:"domains"`
	DomainDetails    []ServiceDomainResponse `json:"domainDetails,omitempty"`
	PublishToHost    bool                    `json:"publishToHost"`
	Replicas         int64                   `json:"replicas"`
	Limits           ServiceLimitsResponse   `json:"limits"`
	EnvVars          []ServiceEnvVarResponse `json:"envVars,omitempty"`
	CreatedAt        string                  `json:"createdAt"`
	UpdatedAt        string                  `json:"updatedAt"`
}

func mapServiceToResponse(s db.Service, domains []string, envVars []ServiceEnvVarResponse, domainDetails ...[]ServiceDomainResponse) ServiceResponse {
	var ports []int32
	_ = json.Unmarshal([]byte(s.Ports), &ports)
	if ports == nil {
		ports = []int32{80}
	}

	var details []ServiceDomainResponse
	if len(domainDetails) > 0 {
		details = domainDetails[0]
	}

	return ServiceResponse{
		ID:               s.ID,
		ProjectID:        s.ProjectID,
		NodeID:           s.NodeID,
		Name:             s.Name,
		Slug:             s.Slug,
		Type:             s.Type,
		Status:           s.Status,
		Repository:       s.Repository,
		Branch:           s.Branch,
		CommitHash:       s.CommitHash,
		Dockerfile:       s.Dockerfile,
		BuildCommand:     s.BuildCommand,
		ComposeFile:      s.ComposeFile,
		Image:            s.Image,
		DatabaseType:     s.DatabaseType,
		DatabaseVersion:  s.DatabaseVersion,
		ConnectionString: s.ConnectionString,
		Ports:            ports,
		Domains:          domains,
		DomainDetails:    details,
		PublishToHost:    s.PublishToHost != 0,
		Replicas:         s.Replicas,
		Limits: ServiceLimitsResponse{
			CPUCores: s.CpuLimit,
			MemoryMB: s.MemoryLimitMb,
		},
		EnvVars:   envVars,
		CreatedAt: s.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: s.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func registerServiceRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/services", func(r chi.Router) {
		// POST /api/v1/services
		r.Post("/", func(w http.ResponseWriter, r *http.Request) {
			var req CreateServiceRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}

			srv, err := orch.CreateService(r.Context(), orchestrator.CreateServiceParams{
				ProjectID:       req.ProjectID,
				NodeID:          req.NodeID,
				Name:            req.Name,
				Slug:            req.Slug,
				Type:            req.Type,
				Repository:      req.Repository,
				Branch:          req.Branch,
				Dockerfile:      req.Dockerfile,
				Image:           req.Image,
				Ports:           req.Ports,
				Domains:         req.Domains,
				EnvironmentVars: req.EnvironmentVars,
				PublishToHost:   req.PublishToHost,
			})
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			envVars := make([]ServiceEnvVarResponse, 0)
			for k, v := range req.EnvironmentVars {
				envVars = append(envVars, ServiceEnvVarResponse{
					ID:       "env-" + randomHexID(4),
					Key:      k,
					Value:    v,
					IsSecret: false,
				})
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(mapServiceToResponse(*srv, req.Domains, envVars))
		})

		// GET /api/v1/services
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			services, err := orch.Queries().ListAllServices(r.Context())
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			res := make([]ServiceResponse, 0, len(services))
			for _, s := range services {
				domainsDB, _ := orch.Queries().ListServiceDomains(r.Context(), s.ID)
				domains := make([]string, 0, len(domainsDB))
				for _, d := range domainsDB {
					domains = append(domains, d.Domain)
				}
				envDB, _ := orch.Queries().ListServiceEnvVars(r.Context(), s.ID)
				envVars := make([]ServiceEnvVarResponse, 0, len(envDB))
				for _, ev := range envDB {
					envVars = append(envVars, ServiceEnvVarResponse{
						ID:       ev.ID,
						Key:      ev.Key,
						Value:    ev.Value,
						IsSecret: ev.IsSecret == 1,
					})
				}
				res = append(res, mapServiceToResponse(s, domains, envVars))
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(res)
		})

		// GET /api/v1/services/{id}
		r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			srv, err := orch.Queries().GetServiceByID(r.Context(), id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					http.Error(w, "service not found", http.StatusNotFound)
					return
				}
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			domainsDB, _ := orch.Queries().ListServiceDomains(r.Context(), srv.ID)
			domains := make([]string, 0, len(domainsDB))
			domainDetails := make([]ServiceDomainResponse, 0, len(domainsDB))
			for _, d := range domainsDB {
				domains = append(domains, d.Domain)
				domainDetails = append(domainDetails, ServiceDomainResponse{
					ID:              d.ID,
					Domain:          d.Domain,
					SSL:             d.Ssl != 0,
					Primary:         d.IsPrimary != 0,
					Port:            d.Port,
					Path:            d.Path,
					CertificateType: d.CertificateType,
					CreatedAt:       d.CreatedAt.Format(time.RFC3339),
				})
			}

			envDB, _ := orch.Queries().ListServiceEnvVars(r.Context(), srv.ID)
			envVars := make([]ServiceEnvVarResponse, 0, len(envDB))
			for _, ev := range envDB {
				envVars = append(envVars, ServiceEnvVarResponse{
					ID:       ev.ID,
					Key:      ev.Key,
					Value:    ev.Value,
					IsSecret: ev.IsSecret == 1,
				})
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(mapServiceToResponse(srv, domains, envVars, domainDetails))
		})

		// DELETE /api/v1/services/{id}
		r.Delete("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			srv, _ := orch.Queries().GetServiceByID(r.Context(), id)
			targetName := id
			if srv.Name != "" {
				targetName = srv.Name
			}

			// Clean up running container and Traefik routing on the agent node
			if srv.ID != "" && srv.NodeID != "" && srv.Slug != "" {
				containerName := "tako-app-" + srv.Slug
				_ = orch.DispatchContainerAction(r.Context(), srv.NodeID, containerName, "remove")
			}

			if err := orch.Queries().DeleteService(r.Context(), id); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "delete_service",
				TargetType: "service",
				TargetID:   id,
				TargetName: targetName,
			})

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
		})

		// PATCH /api/v1/services/{id}
		r.Patch("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			srv, err := orch.Queries().GetServiceByID(r.Context(), id)
			if err != nil {
				http.Error(w, "service not found", http.StatusNotFound)
				return
			}

			var req struct {
				Status        string  `json:"status"`
				Action        string  `json:"action"`
				Name          string  `json:"name"`
				Repository    *string `json:"repository"`
				Branch        string  `json:"branch"`
				CommitHash    *string `json:"commitHash"`
				Dockerfile    string  `json:"dockerfile"`
				BuildCommand  *string `json:"buildCommand"`
				Image         *string `json:"image"`
				Replicas      *int64  `json:"replicas"`
				PublishToHost *bool   `json:"publishToHost"`
				Limits        *struct {
					CPUCores *float64 `json:"cpuCores"`
					MemoryMB *int64   `json:"memoryMb"`
					SwapMB   *int64   `json:"swapMb"`
				} `json:"limits"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}

			hasLimitsUpdate := req.Limits != nil && (req.Limits.CPUCores != nil || req.Limits.MemoryMB != nil)
			hasConfigUpdate := req.Name != "" || req.Repository != nil || req.Branch != "" ||
				req.CommitHash != nil || req.Dockerfile != "" || req.BuildCommand != nil ||
				req.Image != nil || req.Replicas != nil || req.PublishToHost != nil || hasLimitsUpdate

			if hasConfigUpdate {
				var namePtr, branchPtr, dfPtr *string
				if req.Name != "" {
					namePtr = &req.Name
				}
				if req.Branch != "" {
					branchPtr = &req.Branch
				}
				if req.Dockerfile != "" {
					dfPtr = &req.Dockerfile
				}
				var cpuPtr *float64
				var memPtr *int64
				if req.Limits != nil {
					cpuPtr = req.Limits.CPUCores
					memPtr = req.Limits.MemoryMB
				}

				updated, updateErr := orch.UpdateService(r.Context(), id, orchestrator.UpdateServiceParams{
					Name:          namePtr,
					Repository:    req.Repository,
					Branch:        branchPtr,
					CommitHash:    req.CommitHash,
					Dockerfile:    dfPtr,
					BuildCommand:  req.BuildCommand,
					Image:         req.Image,
					Replicas:      req.Replicas,
					PublishToHost: req.PublishToHost,
					CPULimit:      cpuPtr,
					MemoryLimitMB: memPtr,
				})
				if updateErr != nil {
					http.Error(w, updateErr.Error(), http.StatusInternalServerError)
					return
				}
				srv = *updated
			}

			targetStatus := req.Status
			action := strings.ToLower(strings.TrimSpace(req.Action))

			if action == "start" {
				targetStatus = "healthy"
			} else if action == "stop" {
				targetStatus = "stopped"
			} else if action == "restart" {
				targetStatus = "healthy"
			}

			if targetStatus != "" {
				_ = orch.Queries().UpdateServiceStatus(r.Context(), db.UpdateServiceStatusParams{
					ID:     id,
					Status: targetStatus,
				})
				containerName := "tako-app-" + srv.Slug
				if targetStatus == "stopped" || action == "stop" {
					_ = orch.DispatchContainerAction(r.Context(), srv.NodeID, containerName, "stop")
				} else if targetStatus == "healthy" || targetStatus == "running" {
					dispatchAction := "restart"
					if srv.Status == "stopped" || action == "start" {
						dispatchAction = "start"
					}
					_ = orch.DispatchContainerAction(r.Context(), srv.NodeID, containerName, dispatchAction)
				}
				srv.Status = targetStatus
			}

			domains, _ := orch.Queries().ListServiceDomains(r.Context(), id)
			domainStrings := make([]string, len(domains))
			domainDetails := make([]ServiceDomainResponse, len(domains))
			for i, d := range domains {
				domainStrings[i] = d.Domain
				domainDetails[i] = ServiceDomainResponse{
					ID:              d.ID,
					Domain:          d.Domain,
					SSL:             d.Ssl != 0,
					Primary:         d.IsPrimary != 0,
					Port:            d.Port,
					Path:            d.Path,
					CertificateType: d.CertificateType,
					CreatedAt:       d.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
				}
			}
			envVars, _ := orch.Queries().ListServiceEnvVars(r.Context(), id)
			envResponses := make([]ServiceEnvVarResponse, len(envVars))
			for i, ev := range envVars {
				envResponses[i] = ServiceEnvVarResponse{
					ID:       ev.ID,
					Key:      ev.Key,
					Value:    ev.Value,
					IsSecret: ev.IsSecret != 0,
				}
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(mapServiceToResponse(srv, domainStrings, envResponses, domainDetails))
		})

		// GET /api/v1/services/{id}/domains
		r.Get("/{id}/domains", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			domainsDB, err := orch.Queries().ListServiceDomains(r.Context(), id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			res := make([]ServiceDomainResponse, 0, len(domainsDB))
			for _, d := range domainsDB {
				res = append(res, ServiceDomainResponse{
					ID:              d.ID,
					Domain:          d.Domain,
					SSL:             d.Ssl != 0,
					Primary:         d.IsPrimary != 0,
					Port:            d.Port,
					Path:            d.Path,
					CertificateType: d.CertificateType,
					CreatedAt:       d.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
				})
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(res)
		})

		// POST /api/v1/services/{id}/domains
		r.Post("/{id}/domains", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			srv, err := orch.Queries().GetServiceByID(r.Context(), id)
			if err != nil {
				http.Error(w, "service not found", http.StatusNotFound)
				return
			}

			var req struct {
				Domain          string `json:"domain"`
				Port            int64  `json:"port"`
				Path            string `json:"path"`
				SSL             *bool  `json:"ssl"`
				Primary         bool   `json:"primary"`
				CertificateType string `json:"certificateType"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}

			req.Domain = strings.TrimSpace(strings.ToLower(req.Domain))
			if req.Domain == "" {
				http.Error(w, "domain is required", http.StatusBadRequest)
				return
			}
			if req.Port <= 0 {
				req.Port = 80
			}
			if req.Path == "" {
				req.Path = "/"
			}
			sslVal := int64(1)
			if req.SSL != nil && !*req.SSL {
				sslVal = 0
			}
			certType := req.CertificateType
			if certType == "" {
				certType = "letsencrypt"
			}

			existing, _ := orch.Queries().ListServiceDomains(r.Context(), id)
			isPrimary := int64(0)
			if req.Primary || len(existing) == 0 {
				isPrimary = 1
				_, _ = orch.DB().ExecContext(r.Context(), "UPDATE service_domains SET is_primary = 0 WHERE service_id = ?", id)
			}

			domID := "dom-" + randomHexID(8)
			created, err := orch.Queries().CreateServiceDomain(r.Context(), db.CreateServiceDomainParams{
				ID:              domID,
				ServiceID:       id,
				Domain:          req.Domain,
				Ssl:             sslVal,
				IsPrimary:       isPrimary,
				Port:            req.Port,
				Path:            req.Path,
				CertificateType: certType,
			})
			if err != nil {
				http.Error(w, fmt.Sprintf("failed to create domain: %v", err), http.StatusBadRequest)
				return
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "create_service_domain",
				TargetType: "service",
				TargetID:   srv.ID,
				TargetName: srv.Name,
				Metadata: map[string]interface{}{
					"domain":  req.Domain,
					"primary": isPrimary == 1,
				},
			})

			if srv.Status == "healthy" || srv.Status == "running" {
				_, _ = orch.TriggerDeploy(r.Context(), id)
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(ServiceDomainResponse{
				ID:              created.ID,
				Domain:          created.Domain,
				SSL:             created.Ssl != 0,
				Primary:         created.IsPrimary != 0,
				Port:            created.Port,
				Path:            created.Path,
				CertificateType: created.CertificateType,
				CreatedAt:       created.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			})
		})

		// DELETE /api/v1/services/{id}/domains/{domainId}
		r.Delete("/{id}/domains/{domainId}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			domID := chi.URLParam(r, "domainId")
			srv, err := orch.Queries().GetServiceByID(r.Context(), id)
			if err != nil {
				http.Error(w, "service not found", http.StatusNotFound)
				return
			}

			var wasPrimary int64
			_ = orch.DB().QueryRowContext(r.Context(), "SELECT is_primary FROM service_domains WHERE id = ? AND service_id = ?", domID, id).Scan(&wasPrimary)

			_, err = orch.DB().ExecContext(r.Context(), "DELETE FROM service_domains WHERE id = ? AND service_id = ?", domID, id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			if wasPrimary == 1 {
				_, _ = orch.DB().ExecContext(r.Context(), "UPDATE service_domains SET is_primary = 1 WHERE id = (SELECT id FROM service_domains WHERE service_id = ? LIMIT 1)", id)
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "delete_service_domain",
				TargetType: "service",
				TargetID:   srv.ID,
				TargetName: srv.Name,
				Metadata: map[string]interface{}{
					"domainId": domID,
				},
			})

			if srv.Status == "healthy" || srv.Status == "running" {
				_, _ = orch.TriggerDeploy(r.Context(), id)
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
		})

		// PATCH /api/v1/services/{id}/domains/{domainId}/primary
		r.Patch("/{id}/domains/{domainId}/primary", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			domID := chi.URLParam(r, "domainId")

			_, _ = orch.DB().ExecContext(r.Context(), "UPDATE service_domains SET is_primary = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE service_id = ?", domID, id)

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
		})

		// POST /api/v1/services/{id}/deploy
		r.Post("/{id}/deploy", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			var req struct {
				Branch     string `json:"branch"`
				CommitHash string `json:"commitHash"`
			}
			_ = json.NewDecoder(r.Body).Decode(&req)

			dep, err := orch.TriggerDeployWithParams(r.Context(), id, req.Branch, req.CommitHash)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"deploymentId": dep.ID,
				"status":       dep.Status,
			})
		})

		// POST /api/v1/services/{id}/exec (Terminal)
		r.Post("/{id}/exec", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			srv, err := orch.Queries().GetServiceByID(r.Context(), id)
			if err != nil {
				http.Error(w, "service not found", http.StatusNotFound)
				return
			}

			var req struct {
				Command       string `json:"command"`
				ContainerName string `json:"containerName"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Command == "" {
				http.Error(w, "command required", http.StatusBadRequest)
				return
			}

			containerName := "tako-app-" + srv.Slug
			if req.ContainerName != "" {
				containerName = req.ContainerName
			}
			out, code, err := orch.DispatchExec(r.Context(), srv.NodeID, containerName, req.Command)
			res := map[string]any{
				"output":   out,
				"stdout":   out,
				"stderr":   "",
				"exitCode": code,
			}
			if err != nil {
				res["error"] = err.Error()
				res["stderr"] = err.Error()
				if out == "" {
					res["output"] = err.Error()
					res["stdout"] = err.Error()
				}
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(res)
		})

		// GET /api/v1/services/{id}/container-logs (Runtime Logs)
		r.Get("/{id}/container-logs", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			srv, err := orch.Queries().GetServiceByID(r.Context(), id)
			if err != nil {
				http.Error(w, "service not found", http.StatusNotFound)
				return
			}

			containerName := "tako-app-" + srv.Slug
			if cName := r.URL.Query().Get("containerName"); cName != "" {
				containerName = cName
			}
			logs, err := orch.DispatchContainerLogs(r.Context(), srv.NodeID, containerName, 100)
			if err != nil {
				logs = fmt.Sprintf("[%s] Notice: container not active or offline (%v)\n", time.Now().Format("15:04:05"), err)
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{
				"logs": logs,
			})
		})

		// GET /api/v1/services/{id}/env
		r.Get("/{id}/env", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			envDB, err := orch.Queries().ListServiceEnvVars(r.Context(), id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			res := make([]ServiceEnvVarResponse, 0, len(envDB))
			for _, ev := range envDB {
				res = append(res, ServiceEnvVarResponse{
					ID:       ev.ID,
					Key:      ev.Key,
					Value:    ev.Value,
					IsSecret: ev.IsSecret == 1,
				})
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(res)
		})

		// PUT /api/v1/services/{id}/env
		r.Put("/{id}/env", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			srv, err := orch.Queries().GetServiceByID(r.Context(), id)
			if err != nil {
				http.Error(w, "service not found", http.StatusNotFound)
				return
			}

			var reqVars []struct {
				Key      string `json:"key"`
				Value    string `json:"value"`
				IsSecret bool   `json:"isSecret"`
			}
			if err := json.NewDecoder(r.Body).Decode(&reqVars); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}

			// Delete existing
			_ = orch.Queries().DeleteServiceEnvVars(r.Context(), id)

			res := make([]ServiceEnvVarResponse, 0, len(reqVars))
			for _, v := range reqVars {
				if v.Key == "" {
					continue
				}
				isSec := int64(0)
				if v.IsSecret {
					isSec = 1
				}
				ev, err := orch.Queries().CreateServiceEnvVar(r.Context(), db.CreateServiceEnvVarParams{
					ID:        "env-" + randomHexID(8),
					ServiceID: id,
					Key:       v.Key,
					Value:     v.Value,
					IsSecret:  isSec,
				})
				if err == nil {
					res = append(res, ServiceEnvVarResponse{
						ID:       ev.ID,
						Key:      ev.Key,
						Value:    ev.Value,
						IsSecret: ev.IsSecret == 1,
					})
				}
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "update_service_env",
				TargetType: "service",
				TargetID:   srv.ID,
				TargetName: srv.Name,
				Metadata: map[string]interface{}{
					"count": len(res),
				},
			})

			// If service was healthy, re-trigger deployment so new env vars are applied
			if srv.Status == "healthy" {
				_, _ = orch.TriggerDeploy(r.Context(), id)
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(res)
		})

		// GET /api/v1/services/{id}/deployments
		r.Get("/{id}/deployments", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			deps, err := orch.Queries().ListDeploymentsByService(r.Context(), id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(deps)
		})
	})

	r.Route("/deployments", func(r chi.Router) {
		// GET /api/v1/deployments?serviceId=...
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			serviceID := r.URL.Query().Get("serviceId")
			if serviceID != "" {
				deps, err := orch.Queries().ListDeploymentsByService(r.Context(), serviceID)
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(deps)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]any{})
		})

		// GET /api/v1/deployments/{id}
		r.Get("/{id}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			dep, err := orch.GetDeployment(r.Context(), id)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					http.Error(w, "deployment not found", http.StatusNotFound)
					return
				}
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(dep)
		})

		// POST /api/v1/deployments/{id}/rollback
		r.Post("/{id}/rollback", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			dep, err := orch.RollbackDeployment(r.Context(), id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"deploymentId": dep.ID,
				"status":       dep.Status,
			})
		})

		// GET /api/v1/deployments/{id}/logs (SSE)
		r.Get("/{id}/logs", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			dep, err := orch.GetDeployment(r.Context(), id)
			if err != nil {
				http.Error(w, "deployment not found", http.StatusNotFound)
				return
			}

			flusher, ok := w.(http.Flusher)
			if !ok {
				http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")

			// Initial logs
			if dep.Logs != "" {
				lines := strings.Split(dep.Logs, "\n")
				for _, line := range lines {
					trimmed := strings.TrimSpace(line)
					if trimmed != "" {
						_, _ = fmt.Fprintf(w, "event: log\ndata: %s\n\n", trimmed)
					}
				}
				flusher.Flush()
			}

			sub := orch.Bus().Subscribe()
			defer orch.Bus().Unsubscribe(sub)

			ctx := r.Context()
			for {
				select {
				case <-ctx.Done():
					return
				case ev, ok := <-sub:
					if !ok {
						return
					}
					if ev.Type == events.EventDeploymentLog {
						if p, ok := ev.Payload.(map[string]any); ok && p["deployment_id"] == id {
							data, _ := json.Marshal(p)
							_, _ = fmt.Fprintf(w, "event: log\ndata: %s\n\n", data)
							flusher.Flush()
						}
					}
				}
			}
		})

		// GET /api/v1/deployments/{id}/logs/history
		r.Get("/{id}/logs/history", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "id")
			dep, err := orch.GetDeployment(r.Context(), id)
			if err != nil {
				http.Error(w, "deployment not found", http.StatusNotFound)
				return
			}

			w.Header().Set("Content-Type", "text/plain")
			_, _ = w.Write([]byte(dep.Logs))
		})
	})
}
