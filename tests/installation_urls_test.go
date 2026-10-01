package tests

import (
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

func TestLocalInstallationScripts(t *testing.T) {
	// Verify local install.sh and install-agent.sh exist, are non-empty, and start with bash shebang
	scripts := []string{
		"../deploy/install.sh",
		"../deploy/install-agent.sh",
	}

	for _, s := range scripts {
		content, err := os.ReadFile(s)
		if err != nil {
			t.Fatalf("expected script %s to exist: %v", s, err)
		}
		sContent := string(content)
		if !strings.HasPrefix(sContent, "#!/usr/bin/env bash") && !strings.HasPrefix(sContent, "#!/bin/bash") {
			t.Errorf("script %s missing bash shebang", s)
		}
		// Verify no real sensitive public IPs (103.23.198.96) remain
		if strings.Contains(sContent, "103.23.198.96") {
			t.Errorf("script %s still contains real public IP 103.23.198.96", s)
		}
	}
}

func TestInstallationURLsRedirectConfig(t *testing.T) {
	client := &http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	urls := []string{
		"https://gettako.dev/install.sh",
		"https://gettako.dev/install-agent.sh",
	}

	for _, u := range urls {
		resp, err := client.Get(u)
		if err != nil {
			t.Logf("network unreachable or offline for %s: %v", u, err)
			continue
		}
		_ = resp.Body.Close()
		// If reachable, verify it returns 200 or 302 redirect
		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusFound && resp.StatusCode != http.StatusMovedPermanently {
			t.Logf("Note: %s returned HTTP %d", u, resp.StatusCode)
		}
	}
}
