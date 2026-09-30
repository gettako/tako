package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/models"
)

func TestHandler_ValidateCompose(t *testing.T) {
	_, r, cookie := setupTestRouter(t)

	// Valid compose
	validYAML := `
version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
  db:
    image: postgres:16-alpine
`
	body, _ := json.Marshal(models.ValidateComposeRequest{ComposeContent: validYAML})
	req := httptest.NewRequest(http.MethodPost, "/api/services/validate-compose", bytes.NewReader(body))
	req.AddCookie(cookie)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var res models.ValidateComposeResponse
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !res.Valid {
		t.Fatalf("expected valid compose, got errors: %v", res.Errors)
	}
	if len(res.Services) != 2 {
		t.Fatalf("expected 2 services, got %d", len(res.Services))
	}

	// Invalid compose
	invalidBody, _ := json.Marshal(models.ValidateComposeRequest{ComposeContent: "not a yaml: ["})
	req2 := httptest.NewRequest(http.MethodPost, "/api/services/validate-compose", bytes.NewReader(invalidBody))
	req2.AddCookie(cookie)
	w2 := httptest.NewRecorder()

	r.ServeHTTP(w2, req2)

	var res2 models.ValidateComposeResponse
	_ = json.Unmarshal(w2.Body.Bytes(), &res2)
	if res2.Valid {
		t.Errorf("expected invalid result for bad compose content")
	}
}

func TestHandler_ComposeServiceLifecycle(t *testing.T) {
	_, r, cookie := setupTestRouter(t)

	// 1. Create Server
	srvBody, _ := json.Marshal(models.CreateServerRequest{Name: "Compose Node"})
	srvReq := httptest.NewRequest(http.MethodPost, "/api/servers", bytes.NewReader(srvBody))
	srvReq.AddCookie(cookie)
	srvRec := httptest.NewRecorder()
	r.ServeHTTP(srvRec, srvReq)
	if srvRec.Code != http.StatusCreated {
		t.Fatalf("failed to create server: %s", srvRec.Body.String())
	}
	var srvResp models.CreateServerResponse
	_ = json.Unmarshal(srvRec.Body.Bytes(), &srvResp)

	// 2. Create Project
	prjBody, _ := json.Marshal(models.CreateProjectRequest{Name: "Compose Project"})
	prjReq := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(prjBody))
	prjReq.AddCookie(cookie)
	prjRec := httptest.NewRecorder()
	r.ServeHTTP(prjRec, prjReq)
	if prjRec.Code != http.StatusCreated {
		t.Fatalf("failed to create project: %s", prjRec.Body.String())
	}
	var prj models.Project
	_ = json.Unmarshal(prjRec.Body.Bytes(), &prj)

	composeYAML := `
version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
  worker:
    image: redis:alpine
`

	// 3. Create Compose Service with inline content
	svcType := models.ServiceTypeCompose
	createReq := models.CreateServiceRequest{
		ProjectID:          prj.ID,
		ServerID:           srvResp.Server.ID,
		Name:               "my-compose-stack",
		ServiceType:        &svcType,
		ComposeFileContent: &composeYAML,
	}

	body, _ := json.Marshal(createReq)
	req := httptest.NewRequest(http.MethodPost, "/api/services", bytes.NewReader(body))
	req.AddCookie(cookie)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", w.Code, w.Body.String())
	}

	var created models.Service
	_ = json.Unmarshal(w.Body.Bytes(), &created)

	if created.ServiceType != models.ServiceTypeCompose {
		t.Errorf("expected service_type compose, got %s", created.ServiceType)
	}
	if created.ComposeFileContent == nil || *created.ComposeFileContent != composeYAML {
		t.Errorf("expected compose_file_content to match")
	}

	// 4. Get Stack Overview
	reqStack := httptest.NewRequest(http.MethodGet, "/api/services/"+created.ID+"/stack", nil)
	reqStack.AddCookie(cookie)
	wStack := httptest.NewRecorder()

	r.ServeHTTP(wStack, reqStack)

	if wStack.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", wStack.Code, wStack.Body.String())
	}

	var overview models.ComposeStackOverview
	if err := json.Unmarshal(wStack.Body.Bytes(), &overview); err != nil {
		t.Fatalf("failed to decode stack overview: %v", err)
	}

	if overview.NetworkName != "tako_compose_"+prj.ID {
		t.Errorf("expected network name %s, got %s", "tako_compose_"+prj.ID, overview.NetworkName)
	}
	if len(overview.SubServices) != 2 {
		t.Fatalf("expected 2 subservices, got %d", len(overview.SubServices))
	}

	// 5. Update Compose Service
	updatedYAML := `
version: '3.8'
services:
  web:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
`
	updateReq := models.UpdateServiceRequest{
		ComposeFileContent: &updatedYAML,
	}
	upBody, _ := json.Marshal(updateReq)

	reqUp := httptest.NewRequest(http.MethodPatch, "/api/services/"+created.ID, bytes.NewReader(upBody))
	reqUp.AddCookie(cookie)
	wUp := httptest.NewRecorder()

	r.ServeHTTP(wUp, reqUp)

	if wUp.Code != http.StatusOK {
		t.Fatalf("expected status 200 for update, got %d: %s", wUp.Code, wUp.Body.String())
	}

	var updated models.Service
	_ = json.Unmarshal(wUp.Body.Bytes(), &updated)
	if updated.ComposeFileContent == nil || *updated.ComposeFileContent != updatedYAML {
		t.Errorf("expected updated compose_file_content")
	}
}
