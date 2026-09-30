package dns

import (
	"testing"
)

func TestGeneratePreviewDomain(t *testing.T) {
	tests := []struct {
		name         string
		prNumber     int
		customDomain string
		serverHost   string
		template     string
		expected     string
	}{
		{
			name:         "Custom domain present without template",
			prNumber:     42,
			customDomain: "myapp.gettako.dev",
			serverHost:   "1.2.3.4",
			template:     "",
			expected:     "42.myapp.gettako.dev",
		},
		{
			name:         "Custom domain with https prefix and port",
			prNumber:     10,
			customDomain: "https://example.com:443/",
			serverHost:   "1.2.3.4",
			template:     "",
			expected:     "10.example.com",
		},
		{
			name:         "No custom domain, public IPv4 server host",
			prNumber:     42,
			customDomain: "",
			serverHost:   "93.184.216.34",
			template:     "",
			expected:     "42.93-184-216-34.sslip.io",
		},
		{
			name:         "No custom domain, localhost",
			prNumber:     7,
			customDomain: "",
			serverHost:   "localhost",
			template:     "",
			expected:     "7.127-0-0-1.sslip.io",
		},
		{
			name:         "Template {number}.{custom}",
			prNumber:     42,
			customDomain: "gettako.dev",
			serverHost:   "1.2.3.4",
			template:     "{number}.{custom}",
			expected:     "42.gettako.dev",
		},
		{
			name:         "Template {number}.{server-ip}.sslip.io",
			prNumber:     42,
			customDomain: "",
			serverHost:   "192.168.1.100",
			template:     "{number}.{server-ip}.sslip.io",
			expected:     "42.192-168-1-100.sslip.io",
		},
		{
			name:         "Template with pr prefix pr-{number}.{custom}",
			prNumber:     99,
			customDomain: "test.com",
			serverHost:   "1.2.3.4",
			template:     "pr-{number}.{custom}",
			expected:     "pr-99.test.com",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			actual := GeneratePreviewDomain(tc.prNumber, tc.customDomain, tc.serverHost, tc.template)
			if actual != tc.expected {
				t.Errorf("expected %q, got %q", tc.expected, actual)
			}
		})
	}
}
