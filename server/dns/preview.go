package dns

import (
	"fmt"
	"net"
	"strings"
)

// GeneratePreviewDomain generates an ephemeral subdomain for a pull request preview.
// If customDomain is provided, it uses the format: {number}.{customDomain}.
// If customDomain is empty, it uses sslip.io: {number}.{server-ip}.sslip.io
// (replacing dots with dashes in the IP to guarantee unambiguous Anycast DNS resolution).
// If a custom template is provided, it performs token substitution for {number}, {custom}, and {server-ip}.
func GeneratePreviewDomain(prNumber int, customDomain string, serverHost string, template string) string {
	prPrefix := fmt.Sprintf("pr-%d", prNumber)
	numStr := fmt.Sprintf("%d", prNumber)

	cleanCustom := strings.TrimSpace(customDomain)
	cleanCustom = strings.TrimPrefix(cleanCustom, "http://")
	cleanCustom = strings.TrimPrefix(cleanCustom, "https://")
	if idx := strings.Index(cleanCustom, ":"); idx != -1 {
		cleanCustom = cleanCustom[:idx]
	}
	cleanCustom = strings.TrimSuffix(cleanCustom, "/")

	host := strings.TrimSpace(serverHost)
	if host == "" || host == "localhost" {
		host = "127.0.0.1"
	}
	// If host is an IP, convert dots to dashes for reliable sslip.io resolution (e.g. 192-168-1-1)
	dashedHost := host
	if ip := net.ParseIP(host); ip != nil {
		dashedHost = strings.ReplaceAll(host, ".", "-")
	}

	if template != "" {
		res := template
		if strings.Contains(res, "{pr}") {
			res = strings.ReplaceAll(res, "{pr}", prPrefix)
		}
		if strings.Contains(res, "{number}") {
			res = strings.ReplaceAll(res, "{number}", numStr)
		}
		if strings.Contains(res, "{pr_number}") {
			res = strings.ReplaceAll(res, "{pr_number}", numStr)
		}
		if cleanCustom != "" {
			res = strings.ReplaceAll(res, "{custom}", cleanCustom)
		} else {
			// fallback {custom} to sslip.io if custom is empty
			res = strings.ReplaceAll(res, "{custom}", fmt.Sprintf("%s.sslip.io", dashedHost))
		}
		res = strings.ReplaceAll(res, "{server-ip}", dashedHost)
		res = strings.ReplaceAll(res, "{server_ip}", dashedHost)
		return strings.ToLower(strings.Trim(res, "."))
	}

	if cleanCustom != "" {
		return strings.ToLower(fmt.Sprintf("%s.%s", numStr, cleanCustom))
	}

	return strings.ToLower(fmt.Sprintf("%s.%s.sslip.io", numStr, dashedHost))
}
