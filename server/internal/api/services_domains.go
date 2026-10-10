package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

func handleListServiceDomains(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
	}
}

func handleCreateServiceDomain(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
			InternalPath    string `json:"internalPath"`
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
		if req.InternalPath == "" {
			req.InternalPath = "/"
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
			InternalPath:    req.InternalPath,
			CertificateType: created.CertificateType,
			CreatedAt:       created.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}
}

func handleDeleteServiceDomain(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
	}
}

func handleSetServiceDomainPrimary(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		domID := chi.URLParam(r, "domainId")

		_, _ = orch.DB().ExecContext(r.Context(), "UPDATE service_domains SET is_primary = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE service_id = ?", domID, id)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}
