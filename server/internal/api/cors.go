package api

import (
	"net/http"
	"net/url"
	"os"
	"strings"
)

// corsMiddleware allows the Tako console to call the API from a different
// origin during local development. In production the console proxies API
// requests, so CORS is only needed when the API is used directly.
//
// TAKO_CORS_ORIGINS is a comma-separated list of exact origins. "*" allows
// every origin (without credentials). When unset, localhost origins are
// allowed so `bun run dev` can talk to the server on :8080.
func corsMiddleware(next http.Handler) http.Handler {
	raw := strings.TrimSpace(os.Getenv("TAKO_CORS_ORIGINS"))
	allowAll := raw == "*"

	allowed := make(map[string]struct{})
	for _, part := range strings.Split(raw, ",") {
		origin := strings.TrimSpace(part)
		if origin != "" && !allowAll {
			allowed[origin] = struct{}{}
		}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if corsOriginAllowed(origin, allowed, allowAll) {
				if allowAll {
					w.Header().Set("Access-Control-Allow-Origin", "*")
				} else {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Access-Control-Allow-Credentials", "true")
				}
				w.Header().Add("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, X-Requested-With")
				w.Header().Set("Access-Control-Max-Age", "600")
			}
			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

func corsOriginAllowed(origin string, allowed map[string]struct{}, allowAll bool) bool {
	if allowAll {
		return true
	}
	if _, ok := allowed[origin]; ok {
		return true
	}
	if len(allowed) > 0 {
		return false
	}

	// Default development policy: any localhost origin.
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	switch strings.ToLower(u.Hostname()) {
	case "localhost", "127.0.0.1", "::1":
		return true
	}
	return false
}
