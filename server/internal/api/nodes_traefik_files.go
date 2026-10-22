package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store/db"
	"github.com/go-chi/chi/v5"
)

// TraefikConfigFile represents metadata of a Traefik dynamic configuration file on disk.
type TraefikConfigFile struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	UpdatedAt string `json:"updatedAt"`
	IsCustom  bool   `json:"isCustom"`
	Type      string `json:"type"`
}

// TraefikConfigFileContent includes the complete text content of a Traefik configuration file.
type TraefikConfigFileContent struct {
	TraefikConfigFile
	Content string `json:"content"`
}

// SaveTraefikFileRequest holds updated YAML/TOML/JSON text to write to a Traefik configuration file.
type SaveTraefikFileRequest struct {
	Content string `json:"content"`
}

// isValidTraefikFilename checks for safe file names and valid configuration file extensions (.yml, .yaml, .toml, .json).
func isValidTraefikFilename(name string) bool {
	if name == "" || len(name) > 64 {
		return false
	}
	if strings.Contains(name, "/") || strings.Contains(name, "\\") || strings.Contains(name, "..") {
		return false
	}
	lower := strings.ToLower(name)
	if !strings.HasSuffix(lower, ".yml") && !strings.HasSuffix(lower, ".yaml") && !strings.HasSuffix(lower, ".toml") && !strings.HasSuffix(lower, ".json") {
		return false
	}
	for _, ch := range name {
		if !(ch >= 'a' && ch <= 'z') && !(ch >= 'A' && ch <= 'Z') && !(ch >= '0' && ch <= '9') && ch != '-' && ch != '_' && ch != '.' {
			return false
		}
	}
	return true
}

// getTraefikFileType determines the file type string based on filename extension.
func getTraefikFileType(name string) string {
	lower := strings.ToLower(name)
	if strings.HasSuffix(lower, ".yml") || strings.HasSuffix(lower, ".yaml") {
		return "yaml"
	}
	if strings.HasSuffix(lower, ".toml") {
		return "toml"
	}
	if strings.HasSuffix(lower, ".json") {
		return "json"
	}
	return "yaml"
}

// getAssignedConsoleDomain returns the production custom domain configured for the console.
func getAssignedConsoleDomain(ctx context.Context, orch *orchestrator.Orchestrator) string {
	ds, err := orch.Queries().GetSetting(ctx, "domain_settings")
	if err != nil || ds.Value == "" {
		return ""
	}
	var parsed struct {
		Domain string `json:"domain"`
	}
	if err := json.Unmarshal([]byte(ds.Value), &parsed); err != nil {
		return ""
	}
	d := cleanDomain(parsed.Domain)
	if !isValidDomain(d) || d == "localhost" || d == "127.0.0.1" {
		return ""
	}
	return d
}

// generateConsoleTraefikYaml generates dynamic Traefik routing configuration for Tako Console.
func generateConsoleTraefikYaml(domain string) string {
	d := strings.TrimSpace(domain)
	if d == "" {
		return ""
	}
	return fmt.Sprintf(`# Dynamic configuration for Tako Console reverse proxy
http:
  routers:
    tako-console-secure:
      rule: "Host(%s)"
      entryPoints:
        - websecure
      priority: 100
      tls:
        certResolver: letsencrypt
      service: tako-console-svc

    tako-console-redirect:
      rule: "Host(%s)"
      entryPoints:
        - web
      priority: 100
      middlewares:
        - tako-redirect-ssl
      service: tako-console-svc

  middlewares:
    tako-redirect-ssl:
      redirectScheme:
        scheme: https
        permanent: true

  services:
    tako-console-svc:
      loadBalancer:
        servers:
          - url: "http://tako-console:3000"
`, "`"+d+"`", "`"+d+"`")
}

func defaultTraefikStaticConfig() string {
	return `global:
  checkNewVersion: false
  sendAnonymousUsage: false

api:
  dashboard: false

providers:
  docker:
    exposedByDefault: false
    network: tako-network
    watch: true
  file:
    directory: /etc/traefik/dynamic
    watch: true

entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: "admin@gettako.dev"
      storage: "/acme.json"
      httpChallenge:
        entryPoint: web
`
}

func loadNodeTraefikFiles(ctx context.Context, orch *orchestrator.Orchestrator, nodeID string) (map[string]TraefikConfigFileContent, error) {
	key := fmt.Sprintf("node_traefik_files_%s", nodeID)
	files := make(map[string]TraefikConfigFileContent)

	// 1. Load stored files from DB settings if present
	setting, err := orch.Queries().GetSetting(ctx, key)
	if err == nil && setting.Value != "" {
		var stored map[string]TraefikConfigFileContent
		if err := json.Unmarshal([]byte(setting.Value), &stored); err == nil {
			for k, f := range stored {
				// Purge legacy fake template files if they weren't explicitly customized by user
				if !f.IsCustom {
					if k == "security-headers.yml" || k == "ratelimit.yml" || k == "tako-console.yml" {
						continue
					}
				}
				files[k] = f
			}
		}
	}

	// 2. Ensure static traefik.yml is loaded as root static configuration
	staticPath := "/etc/tako/traefik/traefik.yml"
	var staticContent string
	var staticSize int64
	staticModTime := time.Now().UTC().Format(time.RFC3339)

	if fi, err := os.Stat(staticPath); err == nil && !fi.IsDir() {
		if b, err := os.ReadFile(staticPath); err == nil {
			staticContent = string(b)
			staticSize = fi.Size()
			staticModTime = fi.ModTime().UTC().Format(time.RFC3339)
		}
	}

	if staticContent == "" {
		if existing, exists := files["traefik.yml"]; exists && existing.Content != "" {
			staticContent = existing.Content
			staticSize = int64(len(staticContent))
			staticModTime = existing.UpdatedAt
		} else {
			staticContent = defaultTraefikStaticConfig()
			staticSize = int64(len(staticContent))
		}
	}

	isStaticCustom := false
	if existing, exists := files["traefik.yml"]; exists {
		isStaticCustom = existing.IsCustom
	}
	files["traefik.yml"] = TraefikConfigFileContent{
		TraefikConfigFile: TraefikConfigFile{
			Name:      "traefik.yml",
			Path:      staticPath,
			Size:      staticSize,
			UpdatedAt: staticModTime,
			IsCustom:  isStaticCustom,
			Type:      "yaml",
		},
		Content: staticContent,
	}

	// 3. Scan physical dynamic files on disk if directory exists (/etc/tako/traefik/dynamic)
	dynamicDir := "/etc/tako/traefik/dynamic"
	if entries, err := os.ReadDir(dynamicDir); err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			filename := entry.Name()
			if !isValidTraefikFilename(filename) || filename == "traefik.yml" {
				continue
			}
			fullPath := filepath.Join(dynamicDir, filename)
			fi, err := entry.Info()
			if err != nil {
				continue
			}
			contentBytes, err := os.ReadFile(fullPath)
			if err != nil {
				continue
			}
			// Only include if not already present or refresh content from disk
			if existing, exists := files[filename]; !exists || !existing.IsCustom {
				files[filename] = TraefikConfigFileContent{
					TraefikConfigFile: TraefikConfigFile{
						Name:      filename,
						Path:      fullPath,
						Size:      fi.Size(),
						UpdatedAt: fi.ModTime().UTC().Format(time.RFC3339),
						IsCustom:  true,
						Type:      getTraefikFileType(filename),
					},
					Content: string(contentBytes),
				}
			}
		}
	}

	// 4. tako.yml appears IF AND ONLY IF console is assigned to a domain
	assignedDomain := getAssignedConsoleDomain(ctx, orch)
	if assignedDomain != "" {
		if existing, exists := files["tako.yml"]; !exists || !existing.IsCustom {
			content := generateConsoleTraefikYaml(assignedDomain)
			files["tako.yml"] = TraefikConfigFileContent{
				TraefikConfigFile: TraefikConfigFile{
					Name:      "tako.yml",
					Path:      "/etc/tako/traefik/dynamic/tako.yml",
					Size:      int64(len(content)),
					UpdatedAt: time.Now().UTC().Format(time.RFC3339),
					IsCustom:  false,
					Type:      "yaml",
				},
				Content: content,
			}
		}
	} else {
		if existing, exists := files["tako.yml"]; exists && !existing.IsCustom {
			hasPhysical := false
			if _, err := os.Stat("/etc/tako/traefik/dynamic/tako.yml"); err == nil {
				hasPhysical = true
			}
			if _, err := os.Stat("/etc/tako/traefik/tako.yml"); err == nil {
				hasPhysical = true
			}
			if !hasPhysical {
				delete(files, "tako.yml")
			}
		}
	}

	// Persist sanitized/updated state back to DB settings
	valBytes, err := json.Marshal(files)
	if err == nil {
		_, _ = orch.Queries().SetSetting(ctx, db.SetSettingParams{
			Key:   key,
			Value: string(valBytes),
		})
	}

	return files, nil
}

func saveNodeTraefikFiles(ctx context.Context, orch *orchestrator.Orchestrator, nodeID string, files map[string]TraefikConfigFileContent) error {
	key := fmt.Sprintf("node_traefik_files_%s", nodeID)
	valBytes, err := json.Marshal(files)
	if err != nil {
		return err
	}
	_, err = orch.Queries().SetSetting(ctx, db.SetSettingParams{
		Key:   key,
		Value: string(valBytes),
	})
	return err
}

func handleListNodeTraefikFiles(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		_, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				RespondError(w, http.StatusNotFound, "node not found")
				return
			}
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		filesMap, err := loadNodeTraefikFiles(r.Context(), orch, id)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		list := make([]TraefikConfigFile, 0, len(filesMap))
		for _, f := range filesMap {
			list = append(list, f.TraefikConfigFile)
		}

		sort.Slice(list, func(i, j int) bool {
			if list[i].Name == "traefik.yml" {
				return true
			}
			if list[j].Name == "traefik.yml" {
				return false
			}
			return list[i].Name < list[j].Name
		})

		RespondJSON(w, http.StatusOK, list)
	}
}

func handleGetNodeTraefikFile(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		filename := chi.URLParam(r, "filename")

		if !isValidTraefikFilename(filename) {
			RespondError(w, http.StatusBadRequest, "invalid filename")
			return
		}

		_, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				RespondError(w, http.StatusNotFound, "node not found")
				return
			}
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		filesMap, err := loadNodeTraefikFiles(r.Context(), orch, id)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		file, exists := filesMap[filename]
		if !exists {
			RespondError(w, http.StatusNotFound, "file not found")
			return
		}

		RespondJSON(w, http.StatusOK, file)
	}
}

func handleSaveNodeTraefikFile(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		filename := chi.URLParam(r, "filename")

		if !isValidTraefikFilename(filename) {
			RespondError(w, http.StatusBadRequest, "invalid filename")
			return
		}

		node, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				RespondError(w, http.StatusNotFound, "node not found")
				return
			}
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		var req SaveTraefikFileRequest
		if err := DecodeJSON(r, &req); err != nil {
			RespondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if len(req.Content) > 512*1024 {
			RespondError(w, http.StatusBadRequest, "file size exceeds maximum allowed limit (512KB)")
			return
		}

		filesMap, err := loadNodeTraefikFiles(r.Context(), orch, id)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		isCustom := true
		if existing, exists := filesMap[filename]; exists {
			isCustom = existing.IsCustom
		}
		if filename == "traefik.yml" {
			isCustom = true
		}

		filePath := fmt.Sprintf("/etc/tako/traefik/dynamic/%s", filename)
		if filename == "traefik.yml" {
			filePath = "/etc/tako/traefik/traefik.yml"
		}

		now := time.Now().UTC().Format(time.RFC3339)
		fileItem := TraefikConfigFileContent{
			TraefikConfigFile: TraefikConfigFile{
				Name:      filename,
				Path:      filePath,
				Size:      int64(len(req.Content)),
				UpdatedAt: now,
				IsCustom:  isCustom,
				Type:      getTraefikFileType(filename),
			},
			Content: req.Content,
		}

		filesMap[filename] = fileItem
		if err := saveNodeTraefikFiles(r.Context(), orch, id, filesMap); err != nil {
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Also persist physically to disk if directories exist
		if filename == "traefik.yml" {
			traefikDir := "/etc/tako/traefik"
			if fi, err := os.Stat(traefikDir); err == nil && fi.IsDir() {
				_ = os.WriteFile(filepath.Join(traefikDir, "traefik.yml"), []byte(req.Content), 0644)
			}
		} else {
			dynamicDir := "/etc/tako/traefik/dynamic"
			if fi, err := os.Stat(dynamicDir); err == nil && fi.IsDir() {
				targetFilePath := filepath.Join(dynamicDir, filename)
				_ = os.WriteFile(targetFilePath, []byte(req.Content), 0644)
			}
		}

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "save_node_traefik_file",
			TargetType: "node",
			TargetID:   id,
			TargetName: node.Name,
			Metadata: map[string]interface{}{
				"filename": filename,
				"size":     len(req.Content),
				"node_id":  id,
			},
		})

		RespondJSON(w, http.StatusOK, fileItem)
	}
}

func handleDeleteNodeTraefikFile(orch *orchestrator.Orchestrator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		filename := chi.URLParam(r, "filename")

		if !isValidTraefikFilename(filename) {
			RespondError(w, http.StatusBadRequest, "invalid filename")
			return
		}

		if filename == "traefik.yml" {
			RespondError(w, http.StatusBadRequest, "primary static configuration file (traefik.yml) cannot be deleted")
			return
		}

		node, err := orch.Queries().GetNodeByID(r.Context(), id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				RespondError(w, http.StatusNotFound, "node not found")
				return
			}
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		filesMap, err := loadNodeTraefikFiles(r.Context(), orch, id)
		if err != nil {
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if _, exists := filesMap[filename]; !exists {
			RespondError(w, http.StatusNotFound, "file not found")
			return
		}

		delete(filesMap, filename)
		if err := saveNodeTraefikFiles(r.Context(), orch, id, filesMap); err != nil {
			RespondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Also remove physically from disk if exists
		dynamicDir := "/etc/tako/traefik/dynamic"
		filePath := filepath.Join(dynamicDir, filename)
		_ = os.Remove(filePath)

		_, _ = orch.RecordAudit(r.Context(), orchestrator.AuditLogInput{
			Action:     "delete_node_traefik_file",
			TargetType: "node",
			TargetID:   id,
			TargetName: node.Name,
			Metadata: map[string]interface{}{
				"filename": filename,
				"node_id":  id,
			},
		})

		RespondJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"name":    filename,
		})
	}
}
