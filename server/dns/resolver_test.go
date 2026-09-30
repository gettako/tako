package dns

import (
	"context"
	"errors"
	"net"
	"strings"
	"testing"
)

type mockResolver struct {
	ips []net.IPAddr
	err error
}

func (m *mockResolver) LookupIPAddr(ctx context.Context, host string) ([]net.IPAddr, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.ips, nil
}

func TestDNSChecker(t *testing.T) {
	ctx := context.Background()

	// 1. IP matches expected
	mock := &mockResolver{
		ips: []net.IPAddr{
			{IP: net.ParseIP("203.0.113.10")},
		},
	}
	checker := NewDNSChecker(mock)
	res := checker.Check(ctx, "example.com", "203.0.113.10")
	if !res.Matches {
		t.Errorf("expected match true, got false")
	}
	if strings.Contains(res.ErrorMessage, "—") {
		t.Errorf("error message contains forbidden em dash")
	}

	// 2. IP mismatches expected
	res = checker.Check(ctx, "example.com", "198.51.100.5")
	if res.Matches {
		t.Errorf("expected match false for mismatched IP, got true")
	}
	if !strings.Contains(res.ErrorMessage, "DNS mismatch") {
		t.Errorf("expected DNS mismatch error, got %s", res.ErrorMessage)
	}
	if strings.Contains(res.ErrorMessage, "—") {
		t.Errorf("error message contains forbidden em dash")
	}

	// 3. DNS lookup error
	errMock := &mockResolver{err: errors.New("no such host")}
	errChecker := NewDNSChecker(errMock)
	res = errChecker.Check(ctx, "unknown.local", "203.0.113.10")
	if res.Matches {
		t.Errorf("expected match false on DNS error, got true")
	}
	if !strings.Contains(res.ErrorMessage, "DNS lookup failed") {
		t.Errorf("expected lookup failure message, got %s", res.ErrorMessage)
	}
	if strings.Contains(res.ErrorMessage, "—") {
		t.Errorf("error message contains forbidden em dash")
	}
}
