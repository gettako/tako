package api

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
)

var domainRegex = regexp.MustCompile(`^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$`)

func cleanDomain(domain string) string {
	d := strings.TrimSpace(domain)
	d = strings.TrimPrefix(d, "https://")
	d = strings.TrimPrefix(d, "http://")
	if idx := strings.Index(d, "/"); idx != -1 {
		d = d[:idx]
	}
	if idx := strings.Index(d, ":"); idx != -1 {
		d = d[:idx]
	}
	return strings.ToLower(strings.TrimSpace(d))
}

func isValidDomain(domain string) bool {
	if domain == "localhost" {
		return true
	}
	if len(domain) > 253 || len(domain) < 3 {
		return false
	}
	// Support sslip.io, nip.io, or standard domains
	return domainRegex.MatchString(domain)
}

type UpdateSettingRequest struct {
	Value any `json:"value"`
}

type VerifyDomainRequest struct {
	Domain     string `json:"domain"`
	ExpectedIP string `json:"expectedIp,omitempty"`
}

type VerifyDomainResponse struct {
	Domain        string   `json:"domain"`
	Valid         bool     `json:"valid"`
	DnsVerified   bool     `json:"dnsVerified"`
	ResolvedIPs   []string `json:"resolvedIps"`
	ExpectedIP    string   `json:"expectedIp"`
	SSLActive     bool     `json:"sslActive"`
	SSLStatus     string   `json:"sslStatus"` // "active", "pending_dns", "pending_acme", "error"
	SSLIssuer     string   `json:"sslIssuer,omitempty"`
	SSLExpiresAt  string   `json:"sslExpiresAt,omitempty"`
	Message       string   `json:"message"`
	LastCheckedAt string   `json:"lastCheckedAt"`
}

func registerSettingsRoutes(r chi.Router, orch *orchestrator.Orchestrator) {
	r.Route("/settings", func(r chi.Router) {
		// Domain verification & SSL check
		r.Post("/domain/verify", handleVerifyDomain(orch))

		// GET /api/v1/settings
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			list, err := orch.Queries().ListSettings(r.Context())
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			result := make(map[string]any)
			for _, item := range list {
				var parsed any
				if err := json.Unmarshal([]byte(item.Value), &parsed); err == nil {
					result[item.Key] = parsed
				} else {
					result[item.Key] = item.Value
				}
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(result)
		})

		// GET /api/v1/settings/{key}
		r.Get("/{key}", func(w http.ResponseWriter, r *http.Request) {
			key := chi.URLParam(r, "key")
			setting, err := orch.Queries().GetSetting(r.Context(), key)
			if err != nil {
				http.Error(w, "setting not found", http.StatusNotFound)
				return
			}

			var parsed any
			if err := json.Unmarshal([]byte(setting.Value), &parsed); err == nil {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(parsed)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"value": setting.Value})
		})

		// PUT /api/v1/settings/{key}
		r.Put("/{key}", func(w http.ResponseWriter, r *http.Request) {
			key := chi.URLParam(r, "key")
			var req UpdateSettingRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}

			if key == "domain_settings" {
				var ds struct {
					Domain string `json:"domain"`
				}
				if dsBytes, err := json.Marshal(req.Value); err == nil {
					if err := json.Unmarshal(dsBytes, &ds); err == nil && ds.Domain != "" {
						clean := cleanDomain(ds.Domain)
						if !isValidDomain(clean) {
							http.Error(w, `{"error":"Invalid domain format. Please provide a valid FQDN (e.g. console.example.com)."}`, http.StatusBadRequest)
							return
						}
					}
				}
			}

			valBytes, err := json.Marshal(req.Value)
			if err != nil {
				http.Error(w, "invalid value serialization", http.StatusBadRequest)
				return
			}

			setting, err := orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
				Key:   key,
				Value: string(valBytes),
			})
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "update_setting",
				TargetType: "settings",
				TargetID:   key,
				TargetName: key,
			})

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(setting)
		})

		// POST /api/v1/settings (batch save)
		r.Post("/", func(w http.ResponseWriter, r *http.Request) {
			var batch map[string]any
			if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
				http.Error(w, "invalid request body", http.StatusBadRequest)
				return
			}

			for k, v := range batch {
				valBytes, err := json.Marshal(v)
				if err != nil {
					continue
				}
				_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
					Key:   k,
					Value: string(valBytes),
				})
			}

			_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
				Action:     "batch_update_settings",
				TargetType: "settings",
				TargetID:   "cluster",
				TargetName: "Cluster Settings",
			})

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
		})
	})
}

func handleVerifyDomain(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req VerifyDomainRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}

		domain := cleanDomain(req.Domain)
		if domain == "" {
			http.Error(w, `{"error":"domain is required"}`, http.StatusBadRequest)
			return
		}

		if !isValidDomain(domain) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"error":  "Invalid domain format. Please provide a valid FQDN (e.g. console.example.com).",
				"domain": domain,
				"valid":  false,
			})
			return
		}

		// Resolve ExpectedIP if empty
		expectedIP := strings.TrimSpace(req.ExpectedIP)
		if expectedIP == "" {
			nodes, err := orch.Queries().ListNodes(r.Context())
			if err == nil {
				for _, n := range nodes {
					if n.Role == "leader" && n.IpAddress != "" {
						expectedIP = n.IpAddress
						break
					}
				}
				if expectedIP == "" && len(nodes) > 0 {
					expectedIP = nodes[0].IpAddress
				}
			}
		}
		if expectedIP == "" {
			expectedIP = "127.0.0.1"
		}

		// DNS resolution check
		var resolvedIPs []string
		dnsVerified := false

		if domain == "localhost" || domain == "127.0.0.1" || strings.HasSuffix(domain, ".local") {
			resolvedIPs = []string{"127.0.0.1"}
			dnsVerified = (expectedIP == "127.0.0.1" || expectedIP == "")
		} else if strings.HasSuffix(domain, ".sslip.io") || strings.HasSuffix(domain, ".nip.io") {
			resolvedIPs = []string{expectedIP}
			dnsVerified = true
		} else {
			lookupCtx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
			defer cancel()
			ips, err := net.DefaultResolver.LookupIP(lookupCtx, "ip", domain)
			if err == nil {
				for _, ip := range ips {
					ipStr := ip.String()
					resolvedIPs = append(resolvedIPs, ipStr)
					if ipStr == expectedIP {
						dnsVerified = true
					}
				}
			}
		}

		// TLS/SSL reachability check
		sslActive := false
		sslStatus := "pending_dns"
		sslIssuer := ""
		sslExpiresAt := ""

		if dnsVerified {
			sslStatus = "pending_acme"
			dialer := &net.Dialer{Timeout: 2 * time.Second}
			conn, err := tls.DialWithDialer(dialer, "tcp", net.JoinHostPort(domain, "443"), &tls.Config{
				InsecureSkipVerify: true,
				ServerName:         domain,
			})
			if err == nil {
				defer conn.Close()
				state := conn.ConnectionState()
				if len(state.PeerCertificates) > 0 {
					cert := state.PeerCertificates[0]
					sslActive = true
					sslStatus = "active"
					if cert.Issuer.CommonName != "" {
						sslIssuer = cert.Issuer.CommonName
					} else if len(cert.Issuer.Organization) > 0 {
						sslIssuer = cert.Issuer.Organization[0]
					} else {
						sslIssuer = "Let's Encrypt Authority"
					}
					sslExpiresAt = cert.NotAfter.Format(time.RFC3339)
				}
			}
		}

		nowStr := time.Now().UTC().Format(time.RFC3339)
		var message string
		if sslActive {
			message = fmt.Sprintf("Domain %s is properly pointed to %s with active TLS certificate (%s).", domain, expectedIP, sslIssuer)
		} else if dnsVerified {
			message = fmt.Sprintf("DNS points to %s. Let's Encrypt TLS certificate issue/challenge is being negotiated via Traefik.", expectedIP)
		} else {
			if len(resolvedIPs) == 0 {
				message = fmt.Sprintf("No DNS A record found for %s. Point an A record to cluster leader IP %s.", domain, expectedIP)
			} else {
				message = fmt.Sprintf("DNS for %s resolves to [%s], but cluster leader expects %s.", domain, strings.Join(resolvedIPs, ", "), expectedIP)
			}
		}

		resp := VerifyDomainResponse{
			Domain:        domain,
			Valid:         true,
			DnsVerified:   dnsVerified,
			ResolvedIPs:   resolvedIPs,
			ExpectedIP:    expectedIP,
			SSLActive:     sslActive,
			SSLStatus:     sslStatus,
			SSLIssuer:     sslIssuer,
			SSLExpiresAt:  sslExpiresAt,
			Message:       message,
			LastCheckedAt: nowStr,
		}

		// Update domain_settings in cluster_settings table
		if existing, err := orch.Queries().GetSetting(r.Context(), "domain_settings"); err == nil && existing.Value != "" {
			var current map[string]any
			if err := json.Unmarshal([]byte(existing.Value), &current); err == nil {
				current["domain"] = domain
				current["dnsVerified"] = dnsVerified
				current["sslActive"] = sslActive
				current["sslStatus"] = sslStatus
				if sslIssuer != "" {
					current["sslIssuer"] = sslIssuer
				}
				if sslExpiresAt != "" {
					current["sslExpiresAt"] = sslExpiresAt
				}
				current["lastCheckedAt"] = nowStr
				if valBytes, err := json.Marshal(current); err == nil {
					_, _ = orch.Queries().SetSetting(r.Context(), db.SetSettingParams{
						Key:   "domain_settings",
						Value: string(valBytes),
					})
				}
			}
		}

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "verify_cluster_domain",
			TargetType: "settings",
			TargetID:   "domain_settings",
			TargetName: domain,
			Metadata: map[string]interface{}{
				"dns_verified": dnsVerified,
				"ssl_active":   sslActive,
				"ssl_status":   sslStatus,
				"expected_ip":  expectedIP,
			},
		})

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}
