package github

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func generateTestRSAPEM(t *testing.T) []byte {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}
	der := x509.MarshalPKCS1PrivateKey(key)
	block := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: der,
	}
	return pem.EncodeToMemory(block)
}

func TestGitHubClient_Unconfigured(t *testing.T) {
	client, err := NewClient(ClientConfig{})
	if err != nil {
		t.Fatalf("unexpected error creating unconfigured client: %v", err)
	}

	if client.IsConfigured() {
		t.Errorf("expected IsConfigured to be false")
	}

	status, err := client.GetStatus(context.Background())
	if err != nil {
		t.Fatalf("unexpected error getting status: %v", err)
	}
	if status.Connected {
		t.Errorf("expected Connected = false, got true")
	}

	repos, err := client.ListRepos(context.Background())
	if err != nil {
		t.Fatalf("unexpected error listing repos: %v", err)
	}
	if len(repos) != 0 {
		t.Errorf("expected empty repos list, got %d", len(repos))
	}

	_, err = client.ListBranches(context.Background(), "owner", "repo")
	if err == nil {
		t.Errorf("expected error listing branches on unconfigured client, got nil")
	}
}

func TestGitHubClient_PAT_Mode(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth != "Bearer test-pat-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		switch r.URL.Path {
		case "/user":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"login":      "octocat",
				"avatar_url": "https://github.com/images/error/octocat_happy.gif",
			})
		case "/user/repos":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"id":             101,
					"name":           "repo-one",
					"full_name":      "octocat/repo-one",
					"private":        false,
					"default_branch": "main",
					"html_url":       "https://github.com/octocat/repo-one",
				},
				{
					"id":             102,
					"name":           "repo-two",
					"full_name":      "octocat/repo-two",
					"private":        true,
					"default_branch": "develop",
					"html_url":       "https://github.com/octocat/repo-two",
				},
			})
		case "/repos/octocat/repo-one/branches":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"name": "main",
					"commit": map[string]any{
						"sha": "abc1234",
					},
					"protected": true,
				},
				{
					"name": "feature-x",
					"commit": map[string]any{
						"sha": "def5678",
					},
					"protected": false,
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client, err := NewClient(ClientConfig{
		PAT:     "test-pat-token",
		BaseURL: server.URL,
	})
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	if !client.IsConfigured() {
		t.Fatalf("expected client to be configured")
	}

	status, err := client.GetStatus(context.Background())
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}
	if !status.Connected {
		t.Errorf("expected Connected = true")
	}
	if status.Username == nil || *status.Username != "octocat" {
		t.Errorf("expected username octocat, got %v", status.Username)
	}

	repos, err := client.ListRepos(context.Background())
	if err != nil {
		t.Fatalf("ListRepos failed: %v", err)
	}
	if len(repos) != 2 {
		t.Fatalf("expected 2 repos, got %d", len(repos))
	}
	if repos[0].Name != "repo-one" || repos[0].Private {
		t.Errorf("unexpected repo[0]: %+v", repos[0])
	}
	if repos[1].Name != "repo-two" || !repos[1].Private {
		t.Errorf("unexpected repo[1]: %+v", repos[1])
	}

	branches, err := client.ListBranches(context.Background(), "octocat", "repo-one")
	if err != nil {
		t.Fatalf("ListBranches failed: %v", err)
	}
	if len(branches) != 2 {
		t.Fatalf("expected 2 branches, got %d", len(branches))
	}
	if branches[0].Name != "main" || branches[0].CommitSHA != "abc1234" || !branches[0].Protected {
		t.Errorf("unexpected branch[0]: %+v", branches[0])
	}
}

func TestGitHubClient_App_Mode_TokenRefresh(t *testing.T) {
	rsaPEM := generateTestRSAPEM(t)
	var mintCount int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/app":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"name": "Tako Deployer",
				"slug": "tako-deployer",
				"owner": map[string]any{
					"login":      "gettako-org",
					"avatar_url": "https://github.com/gettako.png",
				},
			})
		case "/app/installations":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{"id": 998877},
			})
		case "/app/installations/998877/access_tokens":
			count := atomic.AddInt32(&mintCount, 1)
			w.Header().Set("Content-Type", "application/json")
			// Return a token valid for 5 seconds or expired to test refresh
			var exp time.Time
			if count == 1 {
				// Expired soon
				exp = time.Now().Add(-1 * time.Second)
			} else {
				exp = time.Now().Add(1 * time.Hour)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"token":      "ghs_token_" + string(rune('0'+count)),
				"expires_at": exp,
			})
		case "/installation/repositories":
			auth := r.Header.Get("Authorization")
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"total_count": 1,
				"repositories": []map[string]any{
					{
						"id":             555,
						"name":           "app-repo",
						"full_name":      "gettako-org/app-repo",
						"private":        true,
						"default_branch": "main",
						"html_url":       "https://github.com/gettako-org/app-repo",
					},
				},
			})
			_ = auth
		case "/repos/gettako-org/app-repo/branches":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]map[string]any{
				{
					"name": "main",
					"commit": map[string]any{
						"sha": "999888777",
					},
					"protected": true,
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client, err := NewClient(ClientConfig{
		AppID:         "12345",
		PrivateKeyPEM: rsaPEM,
		BaseURL:       server.URL,
	})
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	if !client.IsConfigured() || !client.IsApp() {
		t.Fatalf("expected App configured client")
	}

	status, err := client.GetStatus(context.Background())
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}
	if !status.Connected {
		t.Errorf("expected Connected = true")
	}
	if status.Username == nil || *status.Username != "tako-deployer" {
		t.Errorf("expected username tako-deployer, got %v", status.Username)
	}
	if status.AppInstalled == nil || !*status.AppInstalled {
		t.Errorf("expected AppInstalled = true")
	}

	// First call to list repos will mint token #1 (which is expired)
	repos, err := client.ListRepos(context.Background())
	if err != nil {
		t.Fatalf("ListRepos #1 failed: %v", err)
	}
	if len(repos) != 1 || repos[0].Name != "app-repo" {
		t.Errorf("unexpected repos: %+v", repos)
	}

	// Second call should detect token expired and mint token #2 automatically
	repos2, err := client.ListRepos(context.Background())
	if err != nil {
		t.Fatalf("ListRepos #2 failed: %v", err)
	}
	if len(repos2) != 1 {
		t.Errorf("unexpected repos #2: %+v", repos2)
	}

	if atomic.LoadInt32(&mintCount) < 2 {
		t.Errorf("expected token to be minted at least twice due to expiration, minted: %d", mintCount)
	}

	branches, err := client.ListBranches(context.Background(), "gettako-org", "app-repo")
	if err != nil {
		t.Fatalf("ListBranches failed: %v", err)
	}
	if len(branches) != 1 || branches[0].Name != "main" {
		t.Errorf("unexpected branches: %+v", branches)
	}
}

func TestGitHubClient_PostCommitStatusAndComment(t *testing.T) {
	var statusPosted, commentPosted bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-pat-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		if r.URL.Path == "/repos/octocat/hello-world/statuses/abc1234" && r.Method == http.MethodPost {
			var body map[string]string
			if err := json.NewDecoder(r.Body).Decode(&body); err == nil && body["state"] == "success" {
				statusPosted = true
				w.WriteHeader(http.StatusCreated)
				return
			}
		}

		if r.URL.Path == "/repos/octocat/hello-world/issues/42/comments" && r.Method == http.MethodPost {
			var body map[string]string
			if err := json.NewDecoder(r.Body).Decode(&body); err == nil && body["body"] != "" {
				commentPosted = true
				w.WriteHeader(http.StatusCreated)
				return
			}
		}

		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client, err := NewClient(ClientConfig{
		PAT:     "test-pat-token",
		BaseURL: server.URL,
	})
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	err = client.PostCommitStatus(context.Background(), "octocat", "hello-world", "abc1234", "success", "https://pr-42.myapp.com", "Preview ready", "tako/preview")
	if err != nil {
		t.Fatalf("PostCommitStatus failed: %v", err)
	}
	if !statusPosted {
		t.Errorf("expected status to be posted")
	}

	err = client.PostPRComment(context.Background(), "octocat", "hello-world", 42, "Preview URL: https://pr-42.myapp.com")
	if err != nil {
		t.Fatalf("PostPRComment failed: %v", err)
	}
	if !commentPosted {
		t.Errorf("expected comment to be posted")
	}
}
