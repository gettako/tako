package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/api"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

func TestNodeRetentionAndPruneAPI(t *testing.T) {
	router, orch := setupTestRouter(t)
	ctx := context.Background()

	nodeID := "node-retention-test-01"
	_, err := orch.RegisterNode(ctx, &takov1.RegisterNodeRequest{
		NodeId:      nodeID,
		Name:        "Worker Node Retention",
		EnrollToken: "test-enroll",
	})
	if err != nil {
		t.Fatalf("RegisterNode failed: %v", err)
	}

	t.Run("Get Default Retention Policy", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/nodes/"+nodeID+"/retention", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var res api.NodeRetentionPolicyResponse
		if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if res.NodeID != nodeID {
			t.Errorf("expected node ID %s, got %s", nodeID, res.NodeID)
		}
		if res.KeepImageVersions != 3 {
			t.Errorf("expected default keepImageVersions 3, got %d", res.KeepImageVersions)
		}
		if res.AutoPruneThresholdPercent != 85.0 {
			t.Errorf("expected default threshold 85.0, got %f", res.AutoPruneThresholdPercent)
		}
		if !res.PruneBuildCache {
			t.Errorf("expected default pruneBuildCache true")
		}
	})

	t.Run("Update Retention Policy", func(t *testing.T) {
		keep := int64(5)
		threshold := 75.0
		pruneCache := false

		payload := api.UpdateNodeRetentionPolicyRequest{
			KeepImageVersions:         &keep,
			AutoPruneThresholdPercent: &threshold,
			PruneBuildCache:           &pruneCache,
		}
		data, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPut, "/api/v1/nodes/"+nodeID+"/retention", bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var res api.NodeRetentionPolicyResponse
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if res.KeepImageVersions != 5 {
			t.Errorf("expected keepImageVersions 5, got %d", res.KeepImageVersions)
		}
		if res.AutoPruneThresholdPercent != 75.0 {
			t.Errorf("expected threshold 75.0, got %f", res.AutoPruneThresholdPercent)
		}
		if res.PruneBuildCache {
			t.Errorf("expected pruneBuildCache false")
		}
	})

	t.Run("Prune Node Disk On-Demand", func(t *testing.T) {
		payload := api.PruneNodeDiskRequest{
			All:             false,
			PruneBuildCache: true,
		}
		data, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/nodes/"+nodeID+"/prune", bytes.NewReader(data))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", rec.Code)
		}

		var res api.PruneNodeDiskResponse
		_ = json.NewDecoder(rec.Body).Decode(&res)
		if !res.Success {
			t.Errorf("expected prune success true")
		}
		if res.SpaceReclaimedBytes <= 0 {
			t.Errorf("expected reclaimed bytes > 0, got %d", res.SpaceReclaimedBytes)
		}
		if res.ImagesDeleted <= 0 {
			t.Errorf("expected imagesDeleted > 0, got %d", res.ImagesDeleted)
		}
	})
}
