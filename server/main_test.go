package main

import (
	"testing"
)

func TestResolveLocalHostConfiguredDomain(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"tako.example.com", "tako.example.com"},
		{"203.0.113.1", "203.0.113.1"},
		{"  my-vps.org  ", "my-vps.org"},
	}

	for _, tc := range tests {
		got := resolveLocalHost(tc.input)
		if got != tc.expected {
			t.Errorf("resolveLocalHost(%q) = %q; expected %q", tc.input, got, tc.expected)
		}
	}
}

func TestResolveLocalHostFallback(t *testing.T) {
	// For localhost or empty string, it will either return detected IP or fallback to localhost
	got := resolveLocalHost("localhost")
	if got == "" {
		t.Errorf("expected non-empty host, got empty string")
	}

	gotEmpty := resolveLocalHost("")
	if gotEmpty == "" {
		t.Errorf("expected non-empty host, got empty string")
	}
}
