package compose

import (
	"testing"
)

func TestParseAndValidate_ValidStack(t *testing.T) {
	yamlStr := `
version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    environment:
      - PORT=80
      - NODE_ENV=production
    depends_on:
      - api
  api:
    image: node:20-alpine
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: "postgres://user:pass@db:5432/app"
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: app
      POSTGRES_PASSWORD: secret
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
`

	cf, res := ParseAndValidate(yamlStr)
	if !res.Valid {
		t.Fatalf("expected valid compose, got errors: %v", res.Errors)
	}

	if len(cf.Services) != 3 {
		t.Fatalf("expected 3 services, got %d", len(cf.Services))
	}

	order, err := ResolveStartupOrder(res.Services)
	if err != nil {
		t.Fatalf("expected resolved order, got error: %v", err)
	}

	// db must come before api, api before web
	dbIdx, apiIdx, webIdx := -1, -1, -1
	for i, name := range order {
		switch name {
		case "db":
			dbIdx = i
		case "api":
			apiIdx = i
		case "web":
			webIdx = i
		}
	}

	if !(dbIdx < apiIdx && apiIdx < webIdx) {
		t.Errorf("expected launch order db -> api -> web, got %v", order)
	}
}

func TestParseAndValidate_Errors(t *testing.T) {
	// Empty content
	_, res1 := ParseAndValidate("")
	if res1.Valid || len(res1.Errors) == 0 {
		t.Errorf("expected errors for empty compose")
	}

	// No services
	_, res2 := ParseAndValidate("version: '3.8'\nnetworks:\n  test:\n")
	if res2.Valid || len(res2.Errors) == 0 {
		t.Errorf("expected errors for missing services")
	}

	// Missing image and build
	_, res3 := ParseAndValidate(`
version: '3.8'
services:
  app:
    ports:
      - "80:80"
`)
	if res3.Valid {
		t.Errorf("expected errors for service without image or build")
	}

	// Invalid port
	_, res4 := ParseAndValidate(`
version: '3.8'
services:
  app:
    image: nginx
    ports:
      - "invalid:port"
`)
	if res4.Valid {
		t.Errorf("expected errors for invalid port format")
	}

	// Undefined dependency
	_, res5 := ParseAndValidate(`
version: '3.8'
services:
  app:
    image: nginx
    depends_on:
      - non_existent
`)
	if res5.Valid {
		t.Errorf("expected error for undefined depends_on")
	}

	// Circular dependency
	_, res6 := ParseAndValidate(`
version: '3.8'
services:
  svc1:
    image: alpine
    depends_on:
      - svc2
  svc2:
    image: alpine
    depends_on:
      - svc1
`)
	if res6.Valid {
		t.Errorf("expected error for circular dependency")
	}
}
