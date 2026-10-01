package github

import (
	"bytes"
	"context"
	"crypto/rsa"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"gettako.dev/tako/internal/models"
)

type ClientConfig struct {
	AppID          string
	PrivateKeyPEM  []byte
	InstallationID string
	PAT            string
	BaseURL        string
	HTTPClient     *http.Client
}

type Client struct {
	cfg            ClientConfig
	parsedKey      *rsa.PrivateKey
	tokenMu        sync.RWMutex
	cachedToken    string
	tokenExpiresAt time.Time
}

func LoadPrivateKey(pemStr, pemPath string) ([]byte, error) {
	if strings.TrimSpace(pemStr) != "" {
		return []byte(pemStr), nil
	}
	if strings.TrimSpace(pemPath) != "" {
		return os.ReadFile(pemPath)
	}
	return nil, nil
}

func NewClient(cfg ClientConfig) (*Client, error) {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.github.com"
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")

	if cfg.HTTPClient == nil {
		cfg.HTTPClient = &http.Client{Timeout: 10 * time.Second}
	}

	c := &Client{
		cfg: cfg,
	}

	if len(cfg.PrivateKeyPEM) > 0 {
		key, err := jwt.ParseRSAPrivateKeyFromPEM(cfg.PrivateKeyPEM)
		if err != nil {
			return nil, fmt.Errorf("failed to parse RSA private key: %w", err)
		}
		c.parsedKey = key
	}

	return c, nil
}

func (c *Client) IsConfigured() bool {
	if c.cfg.PAT != "" {
		return true
	}
	return c.cfg.AppID != "" && c.parsedKey != nil
}

func (c *Client) IsApp() bool {
	return c.cfg.AppID != "" && c.parsedKey != nil
}

func (c *Client) MintJWT() (string, error) {
	if c.parsedKey == nil || c.cfg.AppID == "" {
		return "", errors.New("GitHub App credentials (AppID and PrivateKey) not configured")
	}

	now := time.Now()
	claims := jwt.RegisteredClaims{
		Issuer:    c.cfg.AppID,
		IssuedAt:  jwt.NewNumericDate(now.Add(-60 * time.Second)),
		ExpiresAt: jwt.NewNumericDate(now.Add(10 * time.Minute)),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signed, err := token.SignedString(c.parsedKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}
	return signed, nil
}

func (c *Client) GetInstallationToken(ctx context.Context) (string, error) {
	c.tokenMu.RLock()
	if c.cachedToken != "" && time.Now().Add(60*time.Second).Before(c.tokenExpiresAt) {
		tok := c.cachedToken
		c.tokenMu.RUnlock()
		return tok, nil
	}
	c.tokenMu.RUnlock()

	c.tokenMu.Lock()
	defer c.tokenMu.Unlock()

	// Double-check under lock
	if c.cachedToken != "" && time.Now().Add(60*time.Second).Before(c.tokenExpiresAt) {
		return c.cachedToken, nil
	}

	jwtStr, err := c.MintJWT()
	if err != nil {
		return "", err
	}

	installationID := c.cfg.InstallationID
	if installationID == "" {
		// Discover installation ID
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.cfg.BaseURL+"/app/installations", nil)
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+jwtStr)
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

		resp, err := c.cfg.HTTPClient.Do(req)
		if err != nil {
			return "", fmt.Errorf("failed to list installations: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(resp.Body)
			return "", fmt.Errorf("GitHub returned %d listing installations: %s", resp.StatusCode, string(b))
		}

		var installs []struct {
			ID int64 `json:"id"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&installs); err != nil {
			return "", fmt.Errorf("failed to decode installations: %w", err)
		}
		if len(installs) == 0 {
			return "", errors.New("no installations found for GitHub App")
		}
		installationID = fmt.Sprintf("%d", installs[0].ID)
		c.cfg.InstallationID = installationID
	}

	tokenURL := fmt.Sprintf("%s/app/installations/%s/access_tokens", c.cfg.BaseURL, installationID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+jwtStr)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := c.cfg.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to request installation token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("GitHub returned status %d minting installation token: %s", resp.StatusCode, string(b))
	}

	var tokenResp struct {
		Token     string    `json:"token"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", fmt.Errorf("failed to decode token response: %w", err)
	}

	c.cachedToken = tokenResp.Token
	c.tokenExpiresAt = tokenResp.ExpiresAt
	return c.cachedToken, nil
}

func (c *Client) GetAuthToken(ctx context.Context) (string, error) {
	if c.IsApp() {
		return c.GetInstallationToken(ctx)
	}
	if c.cfg.PAT != "" {
		return c.cfg.PAT, nil
	}
	return "", errors.New("GitHub is not configured")
}

func (c *Client) getAuthToken(ctx context.Context) (string, error) {
	return c.GetAuthToken(ctx)
}

func (c *Client) GetStatus(ctx context.Context) (*models.GitHubStatus, error) {
	if !c.IsConfigured() {
		f := false
		return &models.GitHubStatus{
			Connected:    false,
			Username:     nil,
			AvatarURL:    nil,
			AppInstalled: &f,
		}, nil
	}

	if c.IsApp() {
		// GitHub App mode
		jwtStr, err := c.MintJWT()
		if err != nil {
			f := false
			return &models.GitHubStatus{
				Connected:    false,
				Username:     nil,
				AvatarURL:    nil,
				AppInstalled: &f,
			}, nil
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.cfg.BaseURL+"/app", nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+jwtStr)
		req.Header.Set("Accept", "application/vnd.github+json")

		resp, err := c.cfg.HTTPClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch github app info: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(resp.Body)
			return nil, fmt.Errorf("GitHub app info returned %d: %s", resp.StatusCode, string(b))
		}

		var appInfo struct {
			Name  string `json:"name"`
			Slug  string `json:"slug"`
			Owner struct {
				Login     string `json:"login"`
				AvatarURL string `json:"avatar_url"`
			} `json:"owner"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&appInfo); err != nil {
			return nil, fmt.Errorf("failed to parse app info: %w", err)
		}

		t := true
		username := appInfo.Slug
		if username == "" {
			username = appInfo.Owner.Login
		}
		avatarURL := appInfo.Owner.AvatarURL

		return &models.GitHubStatus{
			Connected:    true,
			Username:     &username,
			AvatarURL:    &avatarURL,
			AppInstalled: &t,
		}, nil
	}

	// PAT mode
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.cfg.BaseURL+"/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.PAT)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := c.cfg.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub user info returned %d: %s", resp.StatusCode, string(b))
	}

	var userInfo struct {
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse user info: %w", err)
	}

	f := false
	return &models.GitHubStatus{
		Connected:    true,
		Username:     &userInfo.Login,
		AvatarURL:    &userInfo.AvatarURL,
		AppInstalled: &f,
	}, nil
}

func (c *Client) ListRepos(ctx context.Context) ([]models.GitHubRepo, error) {
	if !c.IsConfigured() {
		return []models.GitHubRepo{}, nil
	}

	token, err := c.getAuthToken(ctx)
	if err != nil {
		return nil, err
	}

	var reqURL string
	if c.IsApp() {
		reqURL = c.cfg.BaseURL + "/installation/repositories?per_page=100"
	} else {
		reqURL = c.cfg.BaseURL + "/user/repos?per_page=100&sort=updated"
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := c.cfg.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch repositories: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub returned %d: %s", resp.StatusCode, string(b))
	}

	type ghRawRepo struct {
		ID            int64  `json:"id"`
		Name          string `json:"name"`
		FullName      string `json:"full_name"`
		Private       bool   `json:"private"`
		DefaultBranch string `json:"default_branch"`
		HTMLURL       string `json:"html_url"`
	}

	var repos []models.GitHubRepo

	if c.IsApp() {
		var appReposResp struct {
			TotalCount   int         `json:"total_count"`
			Repositories []ghRawRepo `json:"repositories"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&appReposResp); err != nil {
			return nil, fmt.Errorf("failed to decode app repositories: %w", err)
		}
		for _, r := range appReposResp.Repositories {
			defBranch := r.DefaultBranch
			if defBranch == "" {
				defBranch = "main"
			}
			repos = append(repos, models.GitHubRepo{
				ID:            r.ID,
				Name:          r.Name,
				FullName:      r.FullName,
				Private:       r.Private,
				DefaultBranch: defBranch,
				HTMLURL:       r.HTMLURL,
			})
		}
	} else {
		var userRepos []ghRawRepo
		if err := json.NewDecoder(resp.Body).Decode(&userRepos); err != nil {
			return nil, fmt.Errorf("failed to decode user repositories: %w", err)
		}
		for _, r := range userRepos {
			defBranch := r.DefaultBranch
			if defBranch == "" {
				defBranch = "main"
			}
			repos = append(repos, models.GitHubRepo{
				ID:            r.ID,
				Name:          r.Name,
				FullName:      r.FullName,
				Private:       r.Private,
				DefaultBranch: defBranch,
				HTMLURL:       r.HTMLURL,
			})
		}
	}

	if repos == nil {
		repos = []models.GitHubRepo{}
	}
	return repos, nil
}

func (c *Client) ListBranches(ctx context.Context, owner, repo string) ([]models.GitHubBranch, error) {
	if !c.IsConfigured() {
		return nil, errors.New("GitHub is not configured")
	}

	token, err := c.getAuthToken(ctx)
	if err != nil {
		return nil, err
	}

	reqURL := fmt.Sprintf("%s/repos/%s/%s/branches?per_page=100", c.cfg.BaseURL, owner, repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := c.cfg.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch branches: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("repository %s/%s not found", owner, repo)
	}
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub returned %d: %s", resp.StatusCode, string(b))
	}

	var rawBranches []struct {
		Name   string `json:"name"`
		Commit struct {
			SHA string `json:"sha"`
		} `json:"commit"`
		Protected bool `json:"protected"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&rawBranches); err != nil {
		return nil, fmt.Errorf("failed to decode branches: %w", err)
	}

	branches := make([]models.GitHubBranch, 0, len(rawBranches))
	for _, b := range rawBranches {
		branches = append(branches, models.GitHubBranch{
			Name:      b.Name,
			CommitSHA: b.Commit.SHA,
			Protected: b.Protected,
		})
	}

	return branches, nil
}

func (c *Client) PostCommitStatus(ctx context.Context, owner, repo, sha, state, targetURL, description, contextStr string) error {
	if !c.IsConfigured() {
		return errors.New("GitHub is not configured")
	}

	token, err := c.getAuthToken(ctx)
	if err != nil {
		return err
	}

	reqURL := fmt.Sprintf("%s/repos/%s/%s/statuses/%s", c.cfg.BaseURL, owner, repo, sha)
	payload := map[string]string{
		"state":       state,
		"target_url":  targetURL,
		"description": description,
		"context":     contextStr,
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := c.cfg.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to post commit status: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("GitHub returned %d posting status: %s", resp.StatusCode, string(b))
	}
	return nil
}

func (c *Client) PostPRComment(ctx context.Context, owner, repo string, prNumber int, commentBody string) error {
	if !c.IsConfigured() {
		return errors.New("GitHub is not configured")
	}

	token, err := c.getAuthToken(ctx)
	if err != nil {
		return err
	}

	reqURL := fmt.Sprintf("%s/repos/%s/%s/issues/%d/comments", c.cfg.BaseURL, owner, repo, prNumber)
	payload := map[string]string{
		"body": commentBody,
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := c.cfg.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to post PR comment: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("GitHub returned %d posting comment: %s", resp.StatusCode, string(b))
	}
	return nil
}

func (c *Client) BaseURL() string {
	return c.cfg.BaseURL
}

func (c *Client) HTTPClient() *http.Client {
	return c.cfg.HTTPClient
}

type AppManifestConversion struct {
	ID            int64  `json:"id"`
	Slug          string `json:"slug"`
	Name          string `json:"name"`
	HTMLURL       string `json:"html_url"`
	ClientID      string `json:"client_id"`
	ClientSecret  string `json:"client_secret"`
	WebhookSecret string `json:"webhook_secret"`
	PEM           string `json:"pem"`
}

func ConvertAppManifest(ctx context.Context, code string, baseURL string, httpClient *http.Client) (*AppManifestConversion, error) {
	if baseURL == "" {
		baseURL = "https://api.github.com"
	}
	baseURL = strings.TrimRight(baseURL, "/")

	if httpClient == nil {
		httpClient = &http.Client{Timeout: 15 * time.Second}
	}

	url := fmt.Sprintf("%s/app-manifests/%s/conversions", baseURL, code)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to convert app manifest: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub returned %d during app conversion: %s", resp.StatusCode, string(b))
	}

	var conversion AppManifestConversion
	if err := json.NewDecoder(resp.Body).Decode(&conversion); err != nil {
		return nil, fmt.Errorf("failed to decode app conversion response: %w", err)
	}

	return &conversion, nil
}

func (c *Client) ListInstallations(ctx context.Context) ([]models.GitHubAppInstallation, error) {
	if c.parsedKey == nil || c.cfg.AppID == "" {
		return nil, errors.New("GitHub App private key and App ID are required to list installations")
	}

	jwtStr, err := c.MintJWT()
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT: %w", err)
	}

	reqURL := c.cfg.BaseURL + "/app/installations?per_page=100"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+jwtStr)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := c.cfg.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list installations: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub returned %d listing installations: %s", resp.StatusCode, string(b))
	}

	var rawList []struct {
		ID      int64 `json:"id"`
		Account struct {
			Login     string `json:"login"`
			AvatarURL string `json:"avatar_url"`
			Type      string `json:"type"`
		} `json:"account"`
		AppID    int64 `json:"app_id"`
		TargetID int64 `json:"target_id"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&rawList); err != nil {
		return nil, fmt.Errorf("failed to decode installations response: %w", err)
	}

	result := make([]models.GitHubAppInstallation, len(rawList))
	for i, item := range rawList {
		var avatar *string
		if item.Account.AvatarURL != "" {
			avatar = &item.Account.AvatarURL
		}
		result[i] = models.GitHubAppInstallation{
			ID:          item.ID,
			AccountName: item.Account.Login,
			AccountType: item.Account.Type,
			AvatarURL:   avatar,
			AppID:       item.AppID,
			TargetID:    item.TargetID,
		}
	}

	return result, nil
}
