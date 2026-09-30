package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"gettako.dev/tako/server/dns"
	"gettako.dev/tako/internal/models"
	"gettako.dev/tako/internal/protocol"
)

type PullRequestWebhookPayload struct {
	Action      string `json:"action"` // opened, synchronize, reopened, closed
	Number      int    `json:"number"`
	PullRequest struct {
		Number int    `json:"number"`
		Title  string `json:"title"`
		State  string `json:"state"`
		Merged bool   `json:"merged"`
		User   struct {
			Login string `json:"login"`
		} `json:"user"`
		Head struct {
			Ref string `json:"ref"`
			SHA string `json:"sha"`
		} `json:"head"`
		Base struct {
			Ref string `json:"ref"`
		} `json:"base"`
	} `json:"pull_request"`
	Repository struct {
		Name     string `json:"name"`
		FullName string `json:"full_name"`
		CloneURL string `json:"clone_url"`
		SSHURL   string `json:"ssh_url"`
		HTMLURL  string `json:"html_url"`
	} `json:"repository"`
}

func (h *Handler) handlePullRequestWebhook(w http.ResponseWriter, r *http.Request, bodyBytes []byte) {
	var payload PullRequestWebhookPayload
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid JSON payload: "+err.Error())
		return
	}

	prNum := payload.Number
	if prNum == 0 {
		prNum = payload.PullRequest.Number
	}
	if prNum <= 0 {
		f := false
		sendJSON(w, http.StatusOK, models.WebhookResponse{Received: true, DeploymentTriggered: &f})
		return
	}

	pushedRepo := NormalizeRepo(payload.Repository.FullName)
	if pushedRepo == "" {
		pushedRepo = NormalizeRepo(payload.Repository.CloneURL)
	}

	type matchedParent struct {
		id                    string
		projectID             string
		serverID              string
		name                  string
		repository            string
		branch                string
		dockerfilePath        string
		internalPort          int
		healthCheckPath       string
		primaryDomain         string
		previewEnabled        bool
		previewDomainTemplate string
		maxPreviews           int
	}

	var matchedParents []matchedParent

	if h.db != nil {
		rows, err := h.db.QueryContext(r.Context(), `
			SELECT id, project_id, server_id, name, repository, branch, dockerfile_path,
			       internal_port, health_check_path, COALESCE(primary_domain, ''),
			       COALESCE(preview_enabled, 1), COALESCE(preview_domain_template, ''), COALESCE(max_previews, 5)
			FROM services
			WHERE is_preview = 0
		`)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var p matchedParent
				var prevEnabled int
				if err := rows.Scan(
					&p.id, &p.projectID, &p.serverID, &p.name, &p.repository, &p.branch,
					&p.dockerfilePath, &p.internalPort, &p.healthCheckPath, &p.primaryDomain,
					&prevEnabled, &p.previewDomainTemplate, &p.maxPreviews,
				); err == nil {
					if NormalizeRepo(p.repository) == pushedRepo {
						p.previewEnabled = prevEnabled != 0
						matchedParents = append(matchedParents, p)
					}
				}
			}
		}
	}

	if len(matchedParents) == 0 {
		f := false
		sendJSON(w, http.StatusOK, models.WebhookResponse{Received: true, DeploymentTriggered: &f})
		return
	}

	action := strings.ToLower(payload.Action)

	// 1. On PR Closed: tear down ephemeral preview container, remove Traefik route, delete DB record
	if action == "closed" {
		for _, parent := range matchedParents {
			var previewID, serverID string
			err := h.db.QueryRowContext(r.Context(), `
				SELECT id, server_id FROM services
				WHERE parent_service_id = ? AND pr_number = ? AND is_preview = 1
			`, parent.id, prNum).Scan(&previewID, &serverID)
			if err == nil && previewID != "" {
				if h.nodeManager != nil && serverID != "" {
					_ = h.nodeManager.SendCommand(r.Context(), serverID, &protocol.ServerMessage{
						Payload: &protocol.ServerMessage_ContainerAction{
							ContainerAction: &protocol.ContainerAction{
								TaskId:    generateID("act"),
								ServiceId: previewID,
								Action:    "delete",
							},
						},
					})
				}
				_, _ = h.db.ExecContext(r.Context(), `DELETE FROM services WHERE id = ?`, previewID)
				slog.Info("cleaned up preview deployment for closed PR",
					slog.Int("pr", prNum),
					slog.String("service_id", previewID),
				)
			}
		}

		f := false
		sendJSON(w, http.StatusOK, models.WebhookResponse{Received: true, DeploymentTriggered: &f})
		return
	}

	// 2. On PR Open / Synchronize / Reopened: create/update ephemeral preview environment
	if action != "opened" && action != "synchronize" && action != "reopened" {
		f := false
		sendJSON(w, http.StatusOK, models.WebhookResponse{Received: true, DeploymentTriggered: &f})
		return
	}

	headBranch := payload.PullRequest.Head.Ref
	commitSHA := payload.PullRequest.Head.SHA
	commitMsg := payload.PullRequest.Title
	commitAuthor := payload.PullRequest.User.Login
	triggerType := "webhook_preview"

	var triggeredID string

	for _, parent := range matchedParents {
		if !parent.previewEnabled {
			continue
		}

		var existingPreviewID, existingDomain string
		_ = h.db.QueryRowContext(r.Context(), `
			SELECT id, COALESCE(primary_domain, '') FROM services
			WHERE parent_service_id = ? AND pr_number = ? AND is_preview = 1
		`, parent.id, prNum).Scan(&existingPreviewID, &existingDomain)

		previewSvcID := existingPreviewID
		previewDomain := existingDomain

		if existingPreviewID == "" {
			// Enforce concurrent previews safeguard
			type activePreview struct {
				id       string
				serverID string
			}
			rows, qErr := h.db.QueryContext(r.Context(), `
				SELECT id, server_id FROM services
				WHERE parent_service_id = ? AND is_preview = 1
				ORDER BY created_at ASC
			`, parent.id)
			if qErr == nil {
				var activeList []activePreview
				for rows.Next() {
					var ap activePreview
					if err := rows.Scan(&ap.id, &ap.serverID); err == nil {
						activeList = append(activeList, ap)
					}
				}
				rows.Close()

				limit := parent.maxPreviews
				if limit <= 0 {
					limit = 5
				}
				if len(activeList) >= limit {
					oldest := activeList[0]
					if h.nodeManager != nil && oldest.serverID != "" {
						_ = h.nodeManager.SendCommand(r.Context(), oldest.serverID, &protocol.ServerMessage{
							Payload: &protocol.ServerMessage_ContainerAction{
								ContainerAction: &protocol.ContainerAction{
									TaskId:    generateID("act"),
									ServiceId: oldest.id,
									Action:    "delete",
								},
							},
						})
					}
					_, _ = h.db.ExecContext(r.Context(), `DELETE FROM services WHERE id = ?`, oldest.id)
					slog.Info("reaped oldest preview to enforce concurrency limit",
						slog.String("reaped_id", oldest.id),
						slog.Int("limit", limit),
					)
				}
			}

			// Resolve server host
			var serverHost string
			_ = h.db.QueryRowContext(r.Context(), `SELECT host FROM servers WHERE id = ?`, parent.serverID).Scan(&serverHost)

			previewDomain = dns.GeneratePreviewDomain(prNum, parent.primaryDomain, serverHost, parent.previewDomainTemplate)
			previewSvcID = generateID("svc")
			previewName := fmt.Sprintf("%s-pr-%d", parent.name, prNum)

			_, insErr := h.db.ExecContext(r.Context(), `
				INSERT INTO services (
					id, project_id, server_id, name, service_type, parent_service_id,
					repository, branch, dockerfile_path, internal_port, health_check_path,
					status, primary_domain, is_preview, pr_number, preview_status,
					auto_deploy, last_activity_at, created_at, updated_at
				) VALUES (
					?, ?, ?, ?, 'preview', ?,
					?, ?, ?, ?, ?,
					'stopped', ?, 1, ?, 'active',
					1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
				)
			`, previewSvcID, parent.projectID, parent.serverID, previewName, parent.id,
				parent.repository, headBranch, parent.dockerfilePath, parent.internalPort, parent.healthCheckPath,
				previewDomain, prNum,
			)
			if insErr != nil {
				slog.Error("failed to insert ephemeral preview service", slog.String("error", insErr.Error()))
				continue
			}

			// Create domain entry for Traefik routing
			domID := generateID("dom")
			_, _ = h.db.ExecContext(r.Context(), `
				INSERT INTO domains (id, service_id, domain, port, ssl_resolver, ssl_status, created_at)
				VALUES (?, ?, ?, ?, 'letsencrypt', 'pending', CURRENT_TIMESTAMP)
			`, domID, previewSvcID, previewDomain, parent.internalPort)
		} else {
			// Update branch and activity timestamp
			_, _ = h.db.ExecContext(r.Context(), `
				UPDATE services SET branch = ?, last_activity_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
				WHERE id = ?
			`, headBranch, previewSvcID)
		}

		// Trigger deployment
		req := &models.CreateDeploymentRequest{
			Branch:        &headBranch,
			CommitSHA:     &commitSHA,
			CommitMessage: &commitMsg,
			CommitAuthor:  &commitAuthor,
			TriggerType:   &triggerType,
		}

		if h.orchestrator != nil {
			_, depErr := h.orchestrator.TriggerDeployment(r.Context(), previewSvcID, req)
			if depErr != nil {
				slog.Error("failed to trigger preview deployment",
					slog.String("preview_id", previewSvcID),
					slog.String("error", depErr.Error()),
				)
			} else {
				triggeredID = previewSvcID
			}
		}

		// Post GitHub commit status and PR comment if GitHub client configured
		if h.githubClient != nil && h.githubClient.IsConfigured() && previewDomain != "" {
			parts := strings.Split(payload.Repository.FullName, "/")
			if len(parts) == 2 {
				owner, repo := parts[0], parts[1]
				previewURL := "https://" + previewDomain
				_ = h.githubClient.PostCommitStatus(r.Context(), owner, repo, commitSHA, "success", previewURL, "Preview deployment ready at "+previewURL, "tako/preview")
				commentBody := fmt.Sprintf("🚀 **Preview Environment Ready!**\n\nPreview URL: %s\nBranch: `%s`\nCommit: `%s`",
					previewURL, headBranch, commitSHA)
				_ = h.githubClient.PostPRComment(r.Context(), owner, repo, prNum, commentBody)
			}
		}
	}

	if triggeredID != "" {
		t := true
		sendJSON(w, http.StatusOK, models.WebhookResponse{
			Received:            true,
			DeploymentTriggered: &t,
			ServiceID:           &triggeredID,
		})
		return
	}

	f := false
	sendJSON(w, http.StatusOK, models.WebhookResponse{
		Received:            true,
		DeploymentTriggered: &f,
	})
}
