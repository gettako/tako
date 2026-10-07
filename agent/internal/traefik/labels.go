package traefik

import (
	"fmt"
	"regexp"
	"strings"
)

var nameSanitizer = regexp.MustCompile(`[^a-zA-Z0-9_\-]`)

type RouteConfig struct {
	ServiceName   string
	ConfigName    string
	ContainerName string
	Domains       []string
	TargetPort    int
	EnableTLS     bool
	ForceHTTPS    bool
	CertResolver  string
	Network       string
	Middlewares   []string
	PathPrefix    string
}

// SanitizeName cleans up service name for Traefik router/service identifiers.
func SanitizeName(s string) string {
	s = nameSanitizer.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

// GenerateLabels builds a standard map of Traefik v3 Docker container labels.
func GenerateLabels(cfg RouteConfig) map[string]string {
	labels := make(map[string]string)
	if len(cfg.Domains) == 0 || cfg.TargetPort <= 0 {
		return labels
	}

	routerName := sanitizeName(cfg.ServiceName)
	if cfg.ConfigName != "" {
		routerName = sanitizeName(cfg.ConfigName)
	}
	if routerName == "" {
		routerName = "app"
	}

	network := cfg.Network
	if network == "" {
		network = "tako-network"
	}

	certResolver := cfg.CertResolver
	if certResolver == "" {
		certResolver = "letsencrypt"
	}

	labels["traefik.enable"] = "true"
	labels["traefik.docker.network"] = network

	// Construct Host rule
	var hostRules []string
	for _, d := range cfg.Domains {
		trimmed := strings.TrimSpace(d)
		if trimmed != "" {
			hostRules = append(hostRules, fmt.Sprintf("Host(`%s`)", trimmed))
		}
	}
	rule := strings.Join(hostRules, " || ")

	if cfg.PathPrefix != "" {
		rule = fmt.Sprintf("(%s) && PathPrefix(`%s`)", rule, cfg.PathPrefix)
	}

	labels[fmt.Sprintf("traefik.http.routers.%s.rule", routerName)] = rule

	// TLS / Entrypoints
	if cfg.EnableTLS {
		labels[fmt.Sprintf("traefik.http.routers.%s.entrypoints", routerName)] = "websecure"
		labels[fmt.Sprintf("traefik.http.routers.%s.tls", routerName)] = "true"
		labels[fmt.Sprintf("traefik.http.routers.%s.tls.certresolver", routerName)] = certResolver
	} else {
		labels[fmt.Sprintf("traefik.http.routers.%s.entrypoints", routerName)] = "web"
	}

	// Service loadbalancer port
	labels[fmt.Sprintf("traefik.http.services.%s.loadbalancer.server.port", routerName)] = fmt.Sprintf("%d", cfg.TargetPort)

	// Middlewares
	if len(cfg.Middlewares) > 0 {
		labels[fmt.Sprintf("traefik.http.routers.%s.middlewares", routerName)] = strings.Join(cfg.Middlewares, ",")
	}

	return labels
}

// AddRateLimitMiddleware adds a rate limiting middleware definition and attaches it to the router.
func AddRateLimitMiddleware(labels map[string]string, serviceName string, average, burst int) {
	name := sanitizeName(serviceName)
	mwName := fmt.Sprintf("%s-ratelimit", name)
	labels[fmt.Sprintf("traefik.http.middlewares.%s.ratelimit.average", mwName)] = fmt.Sprintf("%d", average)
	labels[fmt.Sprintf("traefik.http.middlewares.%s.ratelimit.burst", mwName)] = fmt.Sprintf("%d", burst)

	appendMiddleware(labels, name, mwName)
}

// AddRedirectRegexMiddleware adds a URL redirect regex middleware definition.
func AddRedirectRegexMiddleware(labels map[string]string, serviceName, regex, replacement string) {
	name := sanitizeName(serviceName)
	mwName := fmt.Sprintf("%s-redirect", name)
	labels[fmt.Sprintf("traefik.http.middlewares.%s.redirectregex.regex", mwName)] = regex
	labels[fmt.Sprintf("traefik.http.middlewares.%s.redirectregex.replacement", mwName)] = replacement

	appendMiddleware(labels, name, mwName)
}

func appendMiddleware(labels map[string]string, routerName, mwName string) {
	key := fmt.Sprintf("traefik.http.routers.%s.middlewares", routerName)
	existing, ok := labels[key]
	if !ok || existing == "" {
		labels[key] = mwName
	} else {
		labels[key] = existing + "," + mwName
	}
}

func sanitizeName(s string) string {
	return SanitizeName(s)
}
