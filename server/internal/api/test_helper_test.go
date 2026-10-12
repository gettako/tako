package api

import (
	"context"
	"database/sql"
	"net/http"
	"testing"

	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
	"github.com/go-chi/chi/v5"
)

type internalTestRouterWrapper struct {
	chi.Router
	token string
}

func (tr *internalTestRouterWrapper) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Authorization") == "" && r.Header.Get("Cookie") == "" && r.URL.Query().Get("token") == "" && r.Header.Get("X-No-Auth") != "true" {
		r.Header.Set("Authorization", "Bearer "+tr.token)
	}
	tr.Router.ServeHTTP(w, r)
}

func newTestRouter(t *testing.T, database *sql.DB, orch *orchestrator.Orchestrator) http.Handler {
	t.Helper()
	_ = store.SeedDefaultAdmin(context.Background(), database, "admin@gettako.dev", "secret123")
	user, err := orch.Queries().GetUserByEmail(context.Background(), "admin@gettako.dev")
	if err != nil {
		t.Fatalf("GetAdminUser failed: %v", err)
	}
	token := "test-admin-token-" + user.ID
	orch.RegisterUserSession(token, user)

	router := NewRouter(database, orch)
	return &internalTestRouterWrapper{
		Router: router.(chi.Router),
		token:  token,
	}
}
