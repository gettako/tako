package api_test

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"gopkg.in/yaml.v3"
)

type openAPISpec struct {
	Paths map[string]map[string]interface{} `yaml:"paths"`
}

// TestAllServerEndpointsDocumentedInOpenAPI verifies that every HTTP route
// registered in the Chi router is documented with the correct method in api/openapi.yaml.
func TestAllServerEndpointsDocumentedInOpenAPI(t *testing.T) {
	router, _ := setupTestRouter(t)

	r, ok := router.(chi.Routes)
	if !ok {
		t.Fatalf("router does not implement chi.Routes")
	}

	// 1. Collect all routes registered in the server
	serverEndpoints := make(map[string]map[string]bool)

	walkFn := func(method string, route string, handler http.Handler, middlewares ...func(http.Handler) http.Handler) error {
		// Clean route
		cleaned := strings.TrimSuffix(route, "/")
		if cleaned == "" {
			cleaned = "/"
		}

		if serverEndpoints[cleaned] == nil {
			serverEndpoints[cleaned] = make(map[string]bool)
		}
		serverEndpoints[cleaned][strings.ToUpper(method)] = true
		return nil
	}

	if err := chi.Walk(r, walkFn); err != nil {
		t.Fatalf("chi.Walk failed: %v", err)
	}

	// 2. Load and parse api/openapi.yaml
	candidates := []string{
		filepath.Join("..", "..", "..", "api", "openapi.yaml"),
		filepath.Join("..", "..", "api", "openapi.yaml"),
		filepath.Join("api", "openapi.yaml"),
	}
	var data []byte
	var openapiPath string
	var err error
	for _, p := range candidates {
		data, err = os.ReadFile(p)
		if err == nil {
			openapiPath = p
			break
		}
	}
	if err != nil && len(data) == 0 {
		t.Fatalf("failed to locate api/openapi.yaml from %v: %v", candidates, err)
	}

	var spec openAPISpec
	if err := yaml.Unmarshal(data, &spec); err != nil {
		t.Fatalf("failed to unmarshal openapi.yaml: %v", err)
	}

	// 3. Collect documented endpoints from OpenAPI spec
	documentedEndpoints := make(map[string]map[string]bool)
	for path, methods := range spec.Paths {
		cleanedPath := strings.TrimSuffix(path, "/")
		if cleanedPath == "" {
			cleanedPath = "/"
		}
		if documentedEndpoints[cleanedPath] == nil {
			documentedEndpoints[cleanedPath] = make(map[string]bool)
		}
		for m := range methods {
			documentedEndpoints[cleanedPath][strings.ToUpper(m)] = true
		}
	}

	// 4. Check that every server route is documented in OpenAPI
	var missing []string
	var sortedRoutes []string
	for route := range serverEndpoints {
		sortedRoutes = append(sortedRoutes, route)
	}
	sort.Strings(sortedRoutes)

	for _, route := range sortedRoutes {
		methods := serverEndpoints[route]
		for method := range methods {
			docMethods, pathExists := documentedEndpoints[route]
			if !pathExists || !docMethods[method] {
				missing = append(missing, method+" "+route)
			}
		}
	}

	if len(missing) > 0 {
		t.Errorf("Found %d server endpoint(s) not documented in %s:\n%s",
			len(missing), openapiPath, strings.Join(missing, "\n"))
	}
}
