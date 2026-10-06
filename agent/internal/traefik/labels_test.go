package traefik_test

import (
	"testing"

	"gettako.dev/tako/agent/internal/traefik"
)

func TestGenerateLabels(t *testing.T) {
	t.Run("Standard TLS Single Domain", func(t *testing.T) {
		labels := traefik.GenerateLabels(traefik.RouteConfig{
			ServiceName: "web-app",
			Domains:     []string{"example.com"},
			TargetPort:  3000,
			EnableTLS:   true,
		})

		if labels["traefik.enable"] != "true" {
			t.Errorf("expected traefik.enable=true")
		}
		if labels["traefik.docker.network"] != "tako-network" {
			t.Errorf("expected network tako-network, got %s", labels["traefik.docker.network"])
		}
		if labels["traefik.http.routers.web-app.rule"] != "Host(`example.com`)" {
			t.Errorf("unexpected rule: %s", labels["traefik.http.routers.web-app.rule"])
		}
		if labels["traefik.http.routers.web-app.entrypoints"] != "websecure" {
			t.Errorf("expected websecure entrypoint")
		}
		if labels["traefik.http.routers.web-app.tls.certresolver"] != "letsencrypt" {
			t.Errorf("expected letsencrypt certresolver")
		}
		if labels["traefik.http.services.web-app.loadbalancer.server.port"] != "3000" {
			t.Errorf("expected port 3000")
		}
	})

	t.Run("Multiple Domains Without TLS", func(t *testing.T) {
		labels := traefik.GenerateLabels(traefik.RouteConfig{
			ServiceName: "api-service",
			Domains:     []string{"api.example.com", "v1.example.com"},
			TargetPort:  8080,
			EnableTLS:   false,
		})

		expectedRule := "Host(`api.example.com`) || Host(`v1.example.com`)"
		if labels["traefik.http.routers.api-service.rule"] != expectedRule {
			t.Errorf("expected rule %q, got %q", expectedRule, labels["traefik.http.routers.api-service.rule"])
		}
		if labels["traefik.http.routers.api-service.entrypoints"] != "web" {
			t.Errorf("expected entrypoint web")
		}
		if _, ok := labels["traefik.http.routers.api-service.tls"]; ok {
			t.Errorf("tls should not be present")
		}
	})

	t.Run("Custom Middlewares Attached", func(t *testing.T) {
		labels := traefik.GenerateLabels(traefik.RouteConfig{
			ServiceName: "secure-api",
			Domains:     []string{"secure.example.com"},
			TargetPort:  4000,
			EnableTLS:   true,
		})

		traefik.AddRateLimitMiddleware(labels, "secure-api", 100, 50)
		traefik.AddRedirectRegexMiddleware(labels, "secure-api", "^http://(.*)", "https://$1")

		mwKey := "traefik.http.routers.secure-api.middlewares"
		if labels[mwKey] != "secure-api-ratelimit,secure-api-redirect" {
			t.Errorf("unexpected middlewares string: %s", labels[mwKey])
		}
		if labels["traefik.http.middlewares.secure-api-ratelimit.ratelimit.average"] != "100" {
			t.Errorf("expected rate limit average 100")
		}
	})
}
