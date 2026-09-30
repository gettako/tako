package traefik

import (
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"os"
	"strings"
	"time"
)

type DomainCertInfo struct {
	Domain       string
	Status       string // "active", "pending", "error"
	ExpiresAt    time.Time
	ErrorMessage string
}

type acmeCertificateItem struct {
	Domain struct {
		Main string   `json:"main"`
		SANs []string `json:"sans"`
	} `json:"domain"`
	Certificate string `json:"certificate"`
}

type acmeResolverItem struct {
	Certificates []acmeCertificateItem `json:"Certificates"`
}

type ACMETracker struct {
	acmePath string
}

func NewACMETracker(acmePath string) *ACMETracker {
	if acmePath == "" {
		acmePath = "/etc/traefik/acme/acme.json"
	}
	return &ACMETracker{
		acmePath: acmePath,
	}
}

func (t *ACMETracker) ParseCertificates() (map[string]DomainCertInfo, error) {
	data, err := os.ReadFile(t.acmePath)
	if err != nil {
		if os.IsNotExist(err) {
			return make(map[string]DomainCertInfo), nil
		}
		return nil, fmt.Errorf("failed to read acme storage file: %w", err)
	}

	var rawResolvers map[string]acmeResolverItem
	if err := json.Unmarshal(data, &rawResolvers); err != nil {
		var altResolvers map[string]struct {
			Certificates []acmeCertificateItem `json:"certificates"`
		}
		if altErr := json.Unmarshal(data, &altResolvers); altErr != nil {
			return nil, fmt.Errorf("failed to unmarshal acme.json: %w", err)
		}
		rawResolvers = make(map[string]acmeResolverItem, len(altResolvers))
		for k, v := range altResolvers {
			rawResolvers[k] = acmeResolverItem{Certificates: v.Certificates}
		}
	}

	results := make(map[string]DomainCertInfo)
	now := time.Now()

	for _, resolver := range rawResolvers {
		for _, item := range resolver.Certificates {
			rawCert := strings.TrimSpace(item.Certificate)
			if rawCert == "" {
				continue
			}

			certBytes, err := base64.StdEncoding.DecodeString(rawCert)
			if err != nil {
				certBytes = []byte(rawCert)
			}

			block, _ := pem.Decode(certBytes)
			if block == nil {
				continue
			}

			parsedCert, err := x509.ParseCertificate(block.Bytes)
			if err != nil {
				continue
			}

			status := "active"
			var errMsg string
			if now.After(parsedCert.NotAfter) {
				status = "error"
				errMsg = "certificate expired on " + parsedCert.NotAfter.Format(time.RFC3339)
			}

			domains := append([]string{parsedCert.Subject.CommonName}, parsedCert.DNSNames...)
			if item.Domain.Main != "" {
				domains = append(domains, item.Domain.Main)
			}
			domains = append(domains, item.Domain.SANs...)

			for _, d := range domains {
				d = strings.ToLower(strings.TrimSpace(d))
				if d == "" {
					continue
				}
				results[d] = DomainCertInfo{
					Domain:       d,
					Status:       status,
					ExpiresAt:    parsedCert.NotAfter,
					ErrorMessage: errMsg,
				}
			}
		}
	}

	return results, nil
}

func (t *ACMETracker) CheckDomain(domain string) DomainCertInfo {
	domain = strings.ToLower(strings.TrimSpace(domain))
	certs, err := t.ParseCertificates()
	if err != nil {
		return DomainCertInfo{
			Domain:       domain,
			Status:       "error",
			ErrorMessage: err.Error(),
		}
	}

	if info, exists := certs[domain]; exists {
		return info
	}

	return DomainCertInfo{
		Domain: domain,
		Status: "pending",
	}
}

func (t *ACMETracker) ScanAll(expectedDomains []string) []DomainCertInfo {
	certs, err := t.ParseCertificates()
	if err != nil {
		out := make([]DomainCertInfo, len(expectedDomains))
		for i, d := range expectedDomains {
			out[i] = DomainCertInfo{
				Domain:       d,
				Status:       "error",
				ErrorMessage: err.Error(),
			}
		}
		return out
	}

	out := make([]DomainCertInfo, 0, len(expectedDomains))
	for _, d := range expectedDomains {
		clean := strings.ToLower(strings.TrimSpace(d))
		if clean == "" {
			continue
		}
		if info, ok := certs[clean]; ok {
			out = append(out, info)
		} else {
			out = append(out, DomainCertInfo{
				Domain: clean,
				Status: "pending",
			})
		}
	}

	return out
}
