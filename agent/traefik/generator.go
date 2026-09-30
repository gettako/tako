package traefik

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"

	"golang.org/x/crypto/bcrypt"
	"gopkg.in/yaml.v3"
)

type DynamicConfig struct {
	HTTP HTTPConfig `yaml:"http"`
}

type HTTPConfig struct {
	Routers     map[string]Router     `yaml:"routers,omitempty"`
	Middlewares map[string]Middleware `yaml:"middlewares,omitempty"`
	Services    map[string]Service    `yaml:"services,omitempty"`
}

type Router struct {
	EntryPoints []string   `yaml:"entryPoints,omitempty"`
	Middlewares []string   `yaml:"middlewares,omitempty"`
	Rule        string     `yaml:"rule"`
	Service     string     `yaml:"service"`
	TLS         *RouterTLS `yaml:"tls,omitempty"`
}

type RouterTLS struct {
	CertResolver string `yaml:"certResolver,omitempty"`
}

type Middleware struct {
	StripPrefix   *StripPrefix   `yaml:"stripPrefix,omitempty"`
	RedirectRegex *RedirectRegex `yaml:"redirectRegex,omitempty"`
	BasicAuth     *BasicAuth     `yaml:"basicAuth,omitempty"`
}

type StripPrefix struct {
	Prefixes []string `yaml:"prefixes"`
}

type RedirectRegex struct {
	Regex       string `yaml:"regex"`
	Replacement string `yaml:"replacement"`
	Permanent   bool   `yaml:"permanent"`
}

type BasicAuth struct {
	Users []string `yaml:"users"`
}

type Service struct {
	LoadBalancer LoadBalancer `yaml:"loadBalancer"`
}

type LoadBalancer struct {
	Servers []Server `yaml:"servers"`
}

type Server struct {
	URL string `yaml:"url"`
}

type IngressRule struct {
	RuleID       string `json:"rule_id"`
	Domain       string `json:"domain"`
	ServiceID    string `json:"service_id"`
	IP           string `json:"ip"`
	Port         int32  `json:"port"`
	PathPrefix   string `json:"path_prefix"`
	StripPrefix  bool   `json:"strip_prefix"`
	IsCanonical  bool   `json:"is_canonical"`
	RedirectMode string `json:"redirect_mode"` // "none", "www_to_non_www", "non_www_to_www"
	AuthEnabled  bool   `json:"auth_enabled"`
	AuthUser     string `json:"auth_user"`
	AuthPassword string `json:"auth_password"` // raw or bcrypt hash
	EntryPoints  string `json:"entrypoints"`
	SSLResolver  string `json:"ssl_resolver"`
}

type ServiceRoute struct {
	ServiceID string
	Domains   []string
	IP        string
	Port      int32
	Rules     []IngressRule
}

type Generator struct {
	mu         sync.Mutex
	configPath string
	routes     map[string]ServiceRoute
}

func NewGenerator(configPath string) *Generator {
	if configPath == "" {
		configPath = "/etc/traefik/dynamic/tako.yml"
	}
	return &Generator{
		configPath: configPath,
		routes:     make(map[string]ServiceRoute),
	}
}

// UpdateRoute updates routes using the legacy interface (maintains exact backwards compatibility).
func (g *Generator) UpdateRoute(serviceID string, domains []string, ip string, port int32) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	cleanedDomains := make([]string, 0, len(domains))
	for _, d := range domains {
		d = strings.TrimSpace(d)
		if d != "" {
			cleanedDomains = append(cleanedDomains, d)
		}
	}

	g.routes[serviceID] = ServiceRoute{
		ServiceID: serviceID,
		Domains:   cleanedDomains,
		IP:        ip,
		Port:      port,
		Rules:     nil,
	}

	return g.writeConfigLocked()
}

// UpdateIngressRules updates routes using the advanced ingress rules model.
func (g *Generator) UpdateIngressRules(serviceID string, rules []IngressRule, defaultIP string, defaultPort int32) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	cleanedRules := make([]IngressRule, 0, len(rules))
	domainSet := make(map[string]bool)
	domains := make([]string, 0, len(rules))

	for i, r := range rules {
		d := strings.ToLower(strings.TrimSpace(r.Domain))
		if d == "" {
			continue
		}
		r.Domain = d
		if r.RuleID == "" {
			r.RuleID = fmt.Sprintf("%s_%d_%s", serviceID, i, sanitizeKey(d))
		}
		if r.ServiceID == "" {
			r.ServiceID = serviceID
		}
		if r.IP == "" {
			r.IP = defaultIP
		}
		if r.Port <= 0 {
			if defaultPort > 0 {
				r.Port = defaultPort
			} else {
				r.Port = 3000
			}
		}
		if r.EntryPoints == "" {
			r.EntryPoints = "web,websecure"
		}
		if r.SSLResolver == "" {
			r.SSLResolver = "letsencrypt"
		}
		cleanedRules = append(cleanedRules, r)
		if !domainSet[d] {
			domainSet[d] = true
			domains = append(domains, d)
		}
	}

	g.routes[serviceID] = ServiceRoute{
		ServiceID: serviceID,
		Domains:   domains,
		IP:        defaultIP,
		Port:      defaultPort,
		Rules:     cleanedRules,
	}

	return g.writeConfigLocked()
}

func (g *Generator) RemoveRoute(serviceID string) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	delete(g.routes, serviceID)
	return g.writeConfigLocked()
}

func (g *Generator) GetRoute(serviceID string) (ServiceRoute, bool) {
	g.mu.Lock()
	defer g.mu.Unlock()

	route, ok := g.routes[serviceID]
	return route, ok
}

func (g *Generator) ListRoutes() map[string]ServiceRoute {
	g.mu.Lock()
	defer g.mu.Unlock()

	out := make(map[string]ServiceRoute, len(g.routes))
	for k, v := range g.routes {
		out[k] = v
	}
	return out
}

func sanitizeKey(s string) string {
	var sb strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			sb.WriteRune(r)
		} else {
			sb.WriteRune('_')
		}
	}
	res := sb.String()
	for strings.Contains(res, "__") {
		res = strings.ReplaceAll(res, "__", "_")
	}
	return strings.Trim(res, "_")
}

func (g *Generator) BuildDynamicConfig() *DynamicConfig {
	keys := make([]string, 0, len(g.routes))
	for k := range g.routes {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	routers := make(map[string]Router)
	middlewares := make(map[string]Middleware)
	services := make(map[string]Service)

	for _, k := range keys {
		r := g.routes[k]

		// 1. Backwards compatible simple route mode
		if len(r.Rules) == 0 {
			if len(r.Domains) == 0 {
				continue
			}

			name := "svc_" + r.ServiceID
			parts := make([]string, 0, len(r.Domains))
			for _, d := range r.Domains {
				parts = append(parts, fmt.Sprintf("Host(`%s`)", d))
			}
			rule := strings.Join(parts, " || ")
			entryPoints := []string{"web", "websecure"}
			tls := &RouterTLS{
				CertResolver: "letsencrypt",
			}

			routers[name] = Router{
				EntryPoints: entryPoints,
				Rule:        rule,
				Service:     name,
				TLS:         tls,
			}

			services[name] = Service{
				LoadBalancer: LoadBalancer{
					Servers: []Server{
						{URL: fmt.Sprintf("http://%s:%d", r.IP, r.Port)},
					},
				},
			}
			continue
		}

		// 2. Advanced ingress rules mode
		for _, rule := range r.Rules {
			domain := strings.ToLower(strings.TrimSpace(rule.Domain))
			if domain == "" {
				continue
			}

			port := rule.Port
			if port <= 0 {
				port = 3000
			}

			ip := rule.IP
			if ip == "" {
				ip = "127.0.0.1"
			}

			// Service load balancer target: unique per service container and port
			svcName := fmt.Sprintf("svc_%s_%d", sanitizeKey(rule.ServiceID), port)
			services[svcName] = Service{
				LoadBalancer: LoadBalancer{
					Servers: []Server{
						{URL: fmt.Sprintf("http://%s:%d", ip, port)},
					},
				},
			}

			var routerMiddlewares []string

			// A. Automated 301 Redirects (www to non-www or non-www to www)
			baseDomain := strings.TrimPrefix(domain, "www.")
			wwwDomain := "www." + baseDomain

			if rule.RedirectMode == "www_to_non_www" {
				mwName := fmt.Sprintf("redir_w2nw_%s", sanitizeKey(baseDomain))
				middlewares[mwName] = Middleware{
					RedirectRegex: &RedirectRegex{
						Regex:       "^https?://www\\.(.+)",
						Replacement: "https://${1}",
						Permanent:   true,
					},
				}
				routerMiddlewares = append(routerMiddlewares, mwName)
			} else if rule.RedirectMode == "non_www_to_www" {
				mwName := fmt.Sprintf("redir_nw2w_%s", sanitizeKey(baseDomain))
				middlewares[mwName] = Middleware{
					RedirectRegex: &RedirectRegex{
						Regex:       fmt.Sprintf(`^https?://%s(:[0-9]+)?(/.*)?$`, regexp.QuoteMeta(baseDomain)),
						Replacement: fmt.Sprintf("https://%s${2}", wwwDomain),
						Permanent:   true,
					},
				}
				routerMiddlewares = append(routerMiddlewares, mwName)
			}

			// B. HTTP Basic Authentication Middleware
			if rule.AuthEnabled && strings.TrimSpace(rule.AuthUser) != "" && strings.TrimSpace(rule.AuthPassword) != "" {
				mwName := fmt.Sprintf("auth_%s", sanitizeKey(rule.RuleID))
				pw := strings.TrimSpace(rule.AuthPassword)
				var hashed string
				if strings.HasPrefix(pw, "$2a$") || strings.HasPrefix(pw, "$2b$") || strings.HasPrefix(pw, "$2y$") {
					hashed = pw
				} else {
					h, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
					if err == nil {
						hashed = string(h)
					} else {
						hashed = pw
					}
				}
				middlewares[mwName] = Middleware{
					BasicAuth: &BasicAuth{
						Users: []string{fmt.Sprintf("%s:%s", rule.AuthUser, hashed)},
					},
				}
				routerMiddlewares = append(routerMiddlewares, mwName)
			}

			// C. Strip Prefix Middleware
			cleanPrefix := "/" + strings.Trim(rule.PathPrefix, "/")
			if rule.StripPrefix && cleanPrefix != "/" && strings.TrimSpace(rule.PathPrefix) != "" {
				mwName := fmt.Sprintf("strip_%s", sanitizeKey(rule.RuleID))
				middlewares[mwName] = Middleware{
					StripPrefix: &StripPrefix{
						Prefixes: []string{cleanPrefix},
					},
				}
				routerMiddlewares = append(routerMiddlewares, mwName)
			}

			// D. Construct Traefik Router Rule
			var hostRule string
			if rule.RedirectMode == "www_to_non_www" || rule.RedirectMode == "non_www_to_www" {
				hostRule = fmt.Sprintf("Host(`%s`) || Host(`%s`)", baseDomain, wwwDomain)
			} else {
				hostRule = fmt.Sprintf("Host(`%s`)", domain)
			}

			var fullRule string
			if cleanPrefix != "/" && strings.TrimSpace(rule.PathPrefix) != "" {
				if strings.Contains(hostRule, " || ") {
					fullRule = fmt.Sprintf("(%s) && PathPrefix(`%s`)", hostRule, cleanPrefix)
				} else {
					fullRule = fmt.Sprintf("%s && PathPrefix(`%s`)", hostRule, cleanPrefix)
				}
			} else {
				fullRule = hostRule
			}

			// E. Entrypoints selection
			var entryPoints []string
			if strings.TrimSpace(rule.EntryPoints) != "" {
				for _, ep := range strings.Split(rule.EntryPoints, ",") {
					ep = strings.TrimSpace(ep)
					if ep != "" {
						entryPoints = append(entryPoints, ep)
					}
				}
			}
			if len(entryPoints) == 0 {
				entryPoints = []string{"web", "websecure"}
			}

			// F. TLS & CertResolver
			var tls *RouterTLS
			if rule.SSLResolver != "none" {
				resolver := strings.TrimSpace(rule.SSLResolver)
				if resolver == "" {
					resolver = "letsencrypt"
				}
				tls = &RouterTLS{
					CertResolver: resolver,
				}
			}

			routerName := fmt.Sprintf("rtr_%s_%s", sanitizeKey(rule.ServiceID), sanitizeKey(rule.RuleID))
			routers[routerName] = Router{
				EntryPoints: entryPoints,
				Middlewares: routerMiddlewares,
				Rule:        fullRule,
				Service:     svcName,
				TLS:         tls,
			}
		}
	}

	return &DynamicConfig{
		HTTP: HTTPConfig{
			Routers:     routers,
			Middlewares: middlewares,
			Services:    services,
		},
	}
}

func (g *Generator) writeConfigLocked() error {
	dir := filepath.Dir(g.configPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create dynamic config dir %s: %w", dir, err)
	}

	cfg := g.BuildDynamicConfig()

	var fullPayload []byte
	if len(cfg.HTTP.Routers) == 0 && len(cfg.HTTP.Services) == 0 {
		fullPayload = []byte("# Generated by Tako Agent: No dynamic routes configured\n")
	} else {
		data, err := yaml.Marshal(cfg)
		if err != nil {
			return fmt.Errorf("failed to marshal dynamic yaml config: %w", err)
		}
		header := []byte("# Generated by Tako Agent: DO NOT EDIT MANUALLY\n")
		fullPayload = append(header, data...)
	}

	tmpPath := g.configPath + ".tmp"
	if err := os.WriteFile(tmpPath, fullPayload, 0644); err != nil {
		return fmt.Errorf("failed to write dynamic yaml temp file: %w", err)
	}

	if err := os.Rename(tmpPath, g.configPath); err != nil {
		return fmt.Errorf("failed to rename dynamic yaml config to target %s: %w", g.configPath, err)
	}

	return nil
}
