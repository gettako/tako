package traefik

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"testing"

	"golang.org/x/crypto/bcrypt"
	"gopkg.in/yaml.v3"
)

func TestGeneratorDynamicRoutes(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "dynamic", "tako.yml")

	gen := NewGenerator(configPath)

	err := gen.UpdateRoute("app1", []string{"api.example.com", "api2.example.com"}, "172.18.0.5", 8080)
	if err != nil {
		t.Fatalf("expected no error updating route, got %v", err)
	}

	content, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("failed to read generated config: %v", err)
	}

	var parsed DynamicConfig
	if err := yaml.Unmarshal(content, &parsed); err != nil {
		t.Fatalf("failed to unmarshal yaml output: %v", err)
	}

	router, exists := parsed.HTTP.Routers["svc_app1"]
	if !exists {
		t.Fatalf("expected router svc_app1 in parsed config")
	}

	expectedRule := "Host(`api.example.com`) || Host(`api2.example.com`)"
	if router.Rule != expectedRule {
		t.Errorf("expected rule %q, got %q", expectedRule, router.Rule)
	}
	if router.TLS == nil || router.TLS.CertResolver != "letsencrypt" {
		t.Errorf("expected tls certResolver letsencrypt, got %+v", router.TLS)
	}

	svc, exists := parsed.HTTP.Services["svc_app1"]
	if !exists {
		t.Fatalf("expected service svc_app1 in parsed config")
	}
	if len(svc.LoadBalancer.Servers) != 1 || svc.LoadBalancer.Servers[0].URL != "http://172.18.0.5:8080" {
		t.Errorf("expected server url http://172.18.0.5:8080, got %+v", svc.LoadBalancer.Servers)
	}

	// Route with domain
	err = gen.UpdateRoute("app2", []string{"app2.example.com"}, "172.18.0.6", 3000)
	if err != nil {
		t.Fatalf("failed to add app2 route: %v", err)
	}

	// Route without domain should not be registered in Traefik
	err = gen.UpdateRoute("app3", nil, "172.18.0.7", 4000)
	if err != nil {
		t.Fatalf("failed to add app3 route without domain: %v", err)
	}

	content, err = os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("failed to read config after adding routes: %v", err)
	}
	if err := yaml.Unmarshal(content, &parsed); err != nil {
		t.Fatalf("failed to unmarshal updated yaml: %v", err)
	}

	if _, exists := parsed.HTTP.Routers["svc_app2"]; !exists {
		t.Errorf("expected svc_app2 router to exist in Traefik config")
	}
	if _, exists := parsed.HTTP.Routers["svc_app3"]; exists {
		t.Errorf("expected svc_app3 router to NOT exist in Traefik config for service without domains")
	}

	// Remove route
	err = gen.RemoveRoute("app1")
	if err != nil {
		t.Fatalf("failed to remove route: %v", err)
	}

	content, _ = os.ReadFile(configPath)
	parsed = DynamicConfig{}
	if err := yaml.Unmarshal(content, &parsed); err != nil {
		t.Fatalf("failed to unmarshal yaml after removal: %v", err)
	}

	if _, exists := parsed.HTTP.Routers["svc_app1"]; exists {
		t.Errorf("expected svc_app1 router to be removed")
	}
	if _, exists := parsed.HTTP.Services["svc_app1"]; exists {
		t.Errorf("expected svc_app1 service to be removed")
	}
	if _, exists := parsed.HTTP.Routers["svc_app2"]; !exists {
		t.Errorf("expected svc_app2 router to remain")
	}
	if _, exists := parsed.HTTP.Routers["svc_app3"]; exists {
		t.Errorf("expected svc_app3 router to still not exist")
	}
}

func TestGeneratorAtomicWriteConcurrency(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "dynamic", "tako.yml")
	gen := NewGenerator(configPath)

	var wg sync.WaitGroup
	workers := 10
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			svcID := strings.Repeat("a", id+1)
			_ = gen.UpdateRoute(svcID, []string{"example.com"}, "127.0.0.1", int32(8000+id))
		}(i)
	}
	wg.Wait()

	content, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("failed to read concurrently written config: %v", err)
	}

	var parsed DynamicConfig
	if err := yaml.Unmarshal(content, &parsed); err != nil {
		t.Fatalf("concurrently written file corrupted: %v", err)
	}
}

func TestGeneratorDefaultPath(t *testing.T) {
	gen := NewGenerator("")
	if gen.configPath != "/etc/traefik/dynamic/tako.yml" {
		t.Errorf("expected default configPath to be /etc/traefik/dynamic/tako.yml, got %s", gen.configPath)
	}
}

func TestGeneratorMultiDomainSameContainer(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "dynamic", "tako.yml")
	gen := NewGenerator(configPath)

	// Attach 3 distinct domains to the same service container (172.20.0.10:3000)
	rules := []IngressRule{
		{
			RuleID:      "rule_main",
			Domain:      "example.com",
			ServiceID:   "svc_web",
			IP:          "172.20.0.10",
			Port:        3000,
			IsCanonical: true,
		},
		{
			RuleID:    "rule_alt1",
			Domain:    "myapp.io",
			ServiceID: "svc_web",
			IP:        "172.20.0.10",
			Port:      3000,
		},
		{
			RuleID:    "rule_alt2",
			Domain:    "custom-client.org",
			ServiceID: "svc_web",
			IP:        "172.20.0.10",
			Port:      3000,
		},
	}

	err := gen.UpdateIngressRules("svc_web", rules, "172.20.0.10", 3000)
	if err != nil {
		t.Fatalf("failed to update ingress rules: %v", err)
	}

	cfg := gen.BuildDynamicConfig()

	// All 3 routers must exist
	if len(cfg.HTTP.Routers) != 3 {
		t.Fatalf("expected 3 routers, got %d", len(cfg.HTTP.Routers))
	}

	// Verify all 3 routers point to the exact same backend service
	commonService := "svc_svc_web_3000"
	svc, exists := cfg.HTTP.Services[commonService]
	if !exists {
		t.Fatalf("expected common service %s to exist", commonService)
	}
	if len(svc.LoadBalancer.Servers) != 1 || svc.LoadBalancer.Servers[0].URL != "http://172.20.0.10:3000" {
		t.Fatalf("unexpected load balancer server target: %+v", svc.LoadBalancer.Servers)
	}

	for _, rule := range rules {
		rtrName := "rtr_svc_web_" + rule.RuleID
		rtr, exists := cfg.HTTP.Routers[rtrName]
		if !exists {
			t.Errorf("expected router %s to exist", rtrName)
			continue
		}
		if rtr.Service != commonService {
			t.Errorf("router %s expected to point to %s, got %s", rtrName, commonService, rtr.Service)
		}
		expectedRule := "Host(`" + rule.Domain + "`)"
		if rtr.Rule != expectedRule {
			t.Errorf("router %s expected rule %s, got %s", rtrName, expectedRule, rtr.Rule)
		}
	}
}

func TestGeneratorAutomatedWWWRedirects(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "dynamic", "tako.yml")
	gen := NewGenerator(configPath)

	rules := []IngressRule{
		{
			RuleID:       "rule_redirect",
			Domain:       "example.com",
			ServiceID:    "svc_web",
			IP:           "172.20.0.5",
			Port:         3000,
			RedirectMode: "www_to_non_www",
		},
		{
			RuleID:       "rule_redirect_rev",
			Domain:       "www.awesome.org",
			ServiceID:    "svc_rev",
			IP:           "172.20.0.6",
			Port:         8080,
			RedirectMode: "non_www_to_www",
		},
	}

	err := gen.UpdateIngressRules("svc_web", []IngressRule{rules[0]}, "172.20.0.5", 3000)
	if err != nil {
		t.Fatalf("failed to update rules: %v", err)
	}
	err = gen.UpdateIngressRules("svc_rev", []IngressRule{rules[1]}, "172.20.0.6", 8080)
	if err != nil {
		t.Fatalf("failed to update rules: %v", err)
	}

	cfg := gen.BuildDynamicConfig()

	// 1. Verify www to non-www
	rtr := cfg.HTTP.Routers["rtr_svc_web_rule_redirect"]
	expectedRule := "Host(`example.com`) || Host(`www.example.com`)"
	if rtr.Rule != expectedRule {
		t.Errorf("expected rule %q, got %q", expectedRule, rtr.Rule)
	}
	mwName := "redir_w2nw_example_com"
	if len(rtr.Middlewares) == 0 || rtr.Middlewares[0] != mwName {
		t.Fatalf("expected middleware %s, got %+v", mwName, rtr.Middlewares)
	}
	mw, exists := cfg.HTTP.Middlewares[mwName]
	if !exists || mw.RedirectRegex == nil {
		t.Fatalf("expected redirectRegex middleware %s", mwName)
	}
	if !mw.RedirectRegex.Permanent {
		t.Errorf("expected permanent 301 redirect")
	}

	// Verify regex accurately handles query strings and path
	re := regexp.MustCompile(mw.RedirectRegex.Regex)
	testURL := "http://www.example.com/checkout/step2?promo=FALL2026&user=alice"
	if !re.MatchString(testURL) {
		t.Errorf("expected regex %s to match %s", mw.RedirectRegex.Regex, testURL)
	}
	redirected := re.ReplaceAllString(testURL, mw.RedirectRegex.Replacement)
	expectedRedirect := "https://example.com/checkout/step2?promo=FALL2026&user=alice"
	if redirected != expectedRedirect {
		t.Errorf("expected redirect result %s, got %s", expectedRedirect, redirected)
	}

	// Request to apex example.com should NOT match the www redirect regex
	apexURL := "https://example.com/checkout/step2?promo=FALL2026&user=alice"
	if re.MatchString(apexURL) {
		t.Errorf("regex should not match apex domain %s", apexURL)
	}

	// 2. Verify non-www to www
	revMw := cfg.HTTP.Middlewares["redir_nw2w_awesome_org"]
	if revMw.RedirectRegex == nil {
		t.Fatalf("expected non_www_to_www redirect regex middleware")
	}
	revRe := regexp.MustCompile(revMw.RedirectRegex.Regex)
	nonWwwURL := "https://awesome.org/products?cat=electronics"
	if !revRe.MatchString(nonWwwURL) {
		t.Errorf("expected regex to match non-www %s", nonWwwURL)
	}
	revRedirected := revRe.ReplaceAllString(nonWwwURL, revMw.RedirectRegex.Replacement)
	expectedRev := "https://www.awesome.org/products?cat=electronics"
	if revRedirected != expectedRev {
		t.Errorf("expected %s, got %s", expectedRev, revRedirected)
	}
}

func TestGeneratorBasicAuthAndPathPrefix(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "dynamic", "tako.yml")
	gen := NewGenerator(configPath)

	rules := []IngressRule{
		{
			RuleID:       "rule_api",
			Domain:       "staging.example.com",
			ServiceID:    "svc_api",
			IP:           "172.19.0.2",
			Port:         8000,
			PathPrefix:   "/api/v1",
			StripPrefix:  true,
			AuthEnabled:  true,
			AuthUser:     "staging_admin",
			AuthPassword: "SecretStagingPassword!123",
			EntryPoints:  "websecure",
			SSLResolver:  "letsencrypt",
		},
		{
			RuleID:      "rule_plain",
			Domain:      "internal.corp",
			ServiceID:   "svc_corp",
			IP:          "172.19.0.3",
			Port:        9000,
			EntryPoints: "web",
			SSLResolver: "none",
		},
	}

	err := gen.UpdateIngressRules("svc_api", []IngressRule{rules[0]}, "172.19.0.2", 8000)
	if err != nil {
		t.Fatalf("failed to update rules: %v", err)
	}
	err = gen.UpdateIngressRules("svc_corp", []IngressRule{rules[1]}, "172.19.0.3", 9000)
	if err != nil {
		t.Fatalf("failed to update rules: %v", err)
	}

	cfg := gen.BuildDynamicConfig()

	// 1. Verify Basic Auth and Path Prefix
	apiRtr, exists := cfg.HTTP.Routers["rtr_svc_api_rule_api"]
	if !exists {
		t.Fatalf("expected rtr_svc_api_rule_api to exist")
	}

	expectedRule := "Host(`staging.example.com`) && PathPrefix(`/api/v1`)"
	if apiRtr.Rule != expectedRule {
		t.Errorf("expected rule %q, got %q", expectedRule, apiRtr.Rule)
	}

	if len(apiRtr.EntryPoints) != 1 || apiRtr.EntryPoints[0] != "websecure" {
		t.Errorf("expected entryPoints [websecure], got %+v", apiRtr.EntryPoints)
	}

	// Verify Auth Middleware
	authMw, exists := cfg.HTTP.Middlewares["auth_rule_api"]
	if !exists || authMw.BasicAuth == nil {
		t.Fatalf("expected auth_rule_api basicAuth middleware")
	}
	if len(authMw.BasicAuth.Users) != 1 {
		t.Fatalf("expected 1 user, got %d", len(authMw.BasicAuth.Users))
	}
	parts := strings.SplitN(authMw.BasicAuth.Users[0], ":", 2)
	if parts[0] != "staging_admin" {
		t.Errorf("expected user staging_admin, got %s", parts[0])
	}
	// Verify password hash is valid bcrypt hash matching the plaintext
	err = bcrypt.CompareHashAndPassword([]byte(parts[1]), []byte("SecretStagingPassword!123"))
	if err != nil {
		t.Errorf("bcrypt verification failed: %v", err)
	}

	// Verify Strip Prefix Middleware
	stripMw, exists := cfg.HTTP.Middlewares["strip_rule_api"]
	if !exists || stripMw.StripPrefix == nil {
		t.Fatalf("expected strip_rule_api stripPrefix middleware")
	}
	if len(stripMw.StripPrefix.Prefixes) != 1 || stripMw.StripPrefix.Prefixes[0] != "/api/v1" {
		t.Errorf("expected stripPrefix [/api/v1], got %+v", stripMw.StripPrefix.Prefixes)
	}

	// 2. Verify Plain HTTP and No TLS Resolver
	corpRtr, exists := cfg.HTTP.Routers["rtr_svc_corp_rule_plain"]
	if !exists {
		t.Fatalf("expected rtr_svc_corp_rule_plain")
	}
	if corpRtr.TLS != nil {
		t.Errorf("expected TLS to be nil for ssl_resolver=none, got %+v", corpRtr.TLS)
	}
	if len(corpRtr.EntryPoints) != 1 || corpRtr.EntryPoints[0] != "web" {
		t.Errorf("expected entryPoints [web], got %+v", corpRtr.EntryPoints)
	}
}
