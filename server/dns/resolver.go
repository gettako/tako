package dns

import (
	"context"
	"fmt"
	"net"
	"strings"
)

type Resolver interface {
	LookupIPAddr(ctx context.Context, host string) ([]net.IPAddr, error)
}

type DNSChecker struct {
	resolver Resolver
}

func NewDNSChecker(r Resolver) *DNSChecker {
	if r == nil {
		r = net.DefaultResolver
	}
	return &DNSChecker{resolver: r}
}

type CheckResult struct {
	Matches      bool     `json:"matches"`
	Domain       string   `json:"domain"`
	ExpectedIP   string   `json:"expected_ip"`
	ResolvedIPs  []string `json:"resolved_ips"`
	ErrorMessage string   `json:"error_message,omitempty"`
}

func (c *DNSChecker) Check(ctx context.Context, domain string, expectedIP string) *CheckResult {
	domain = strings.TrimSpace(domain)
	expectedIP = strings.TrimSpace(expectedIP)

	res := &CheckResult{
		Domain:      domain,
		ExpectedIP:  expectedIP,
		ResolvedIPs: make([]string, 0),
	}

	if domain == "" {
		res.ErrorMessage = "domain cannot be empty"
		return res
	}

	ips, err := c.resolver.LookupIPAddr(ctx, domain)
	if err != nil {
		res.ErrorMessage = fmt.Sprintf("DNS lookup failed: %v", err)
		return res
	}

	if len(ips) == 0 {
		res.ErrorMessage = fmt.Sprintf("no A or AAAA records found for domain %s", domain)
		return res
	}

	for _, ip := range ips {
		res.ResolvedIPs = append(res.ResolvedIPs, ip.IP.String())
	}

	if expectedIP == "" || expectedIP == "127.0.0.1" || expectedIP == "localhost" {
		res.Matches = true
		return res
	}

	for _, ip := range ips {
		if ip.IP.String() == expectedIP {
			res.Matches = true
			return res
		}
	}

	res.ErrorMessage = fmt.Sprintf("DNS mismatch: %s resolves to [%s], expected %s", domain, strings.Join(res.ResolvedIPs, ", "), expectedIP)
	return res
}
