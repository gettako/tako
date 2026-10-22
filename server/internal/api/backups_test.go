package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"gettako.dev/tako/internal/events"
	"gettako.dev/tako/internal/orchestrator"
	"gettako.dev/tako/internal/store"
	"gettako.dev/tako/internal/store/db"
)

func TestClusterBackupsFeature(t *testing.T) {
	// Configure isolated backup directory for test
	tempDir := t.TempDir()
	t.Setenv("TAKO_BACKUP_DIR", tempDir)

	database, err := store.OpenDB(":memory:")
	if err != nil {
		t.Fatalf("OpenDB failed: %v", err)
	}
	defer database.Close()

	if err := store.Migrate(database); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	bus := events.NewBus()
	orch := orchestrator.New(database, bus, "test-master-token")
	router := newTestRouter(t, database, orch)

	ctx := context.Background()

	// 1. Initially snapshots list is empty
	t.Run("ListSnapshots_Initial_Empty", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/backups/snapshots", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}
		var list []ClusterBackupSnapshot
		if err := json.NewDecoder(w.Body).Decode(&list); err != nil {
			t.Fatalf("failed to decode json: %v", err)
		}
		if len(list) != 0 {
			t.Fatalf("expected 0 snapshots, got %d", len(list))
		}
	})

	// 2. Unauthenticated snapshot attempt is rejected
	t.Run("CreateSnapshot_Unauthenticated_Rejected", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/backups/snapshot", nil)
		req.Header.Set("X-No-Auth", "true")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 Unauthorized, got %d", w.Code)
		}
	})

	var snap1 ClusterBackupSnapshot

	// 3. Create snapshot 1 (initial state with admin user)
	t.Run("CreateSnapshot_Success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/backups/snapshot", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
		}

		var resp struct {
			OK             bool                  `json:"ok"`
			SnapshotSizeMb float64               `json:"snapshotSizeMb"`
			DurationMs     int64                 `json:"durationMs"`
			Snapshot       ClusterBackupSnapshot `json:"snapshot"`
		}
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode snapshot response: %v", err)
		}

		if !resp.OK {
			t.Errorf("expected ok=true")
		}
		if resp.Snapshot.ID == "" || resp.Snapshot.Filename == "" {
			t.Errorf("expected valid snapshot ID and filename, got %+v", resp.Snapshot)
		}
		if resp.Snapshot.Status != "completed" {
			t.Errorf("expected status completed, got %s", resp.Snapshot.Status)
		}
		if len(resp.Snapshot.Checksum) < 10 {
			t.Errorf("expected valid sha256 checksum, got %s", resp.Snapshot.Checksum)
		}

		// Verify archive exists on disk
		archivePath := filepath.Join(tempDir, resp.Snapshot.Filename)
		if fi, err := os.Stat(archivePath); err != nil || fi.Size() == 0 {
			t.Fatalf("snapshot archive not found or empty at %s", archivePath)
		}

		snap1 = resp.Snapshot
	})

	// 4. Verify snapshot is now listed
	t.Run("ListSnapshots_Contains_Snapshot", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/backups/snapshots", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d", w.Code)
		}
		var list []ClusterBackupSnapshot
		if err := json.NewDecoder(w.Body).Decode(&list); err != nil {
			t.Fatalf("failed to decode list: %v", err)
		}
		if len(list) != 1 || list[0].ID != snap1.ID {
			t.Fatalf("expected 1 snapshot matching %s, got %+v", snap1.ID, list)
		}
	})

	// 5. Test state modification & restore
	t.Run("Create_Data_Snapshot_And_Restore", func(t *testing.T) {
		// Insert a project into the DB
		proj, err := orch.Queries().CreateProject(ctx, db.CreateProjectParams{
			ID:          "proj-backup-test",
			Name:        "Backup Test Project",
			Description: "Project created for backup testing",
		})
		if err != nil {
			t.Fatalf("CreateProject failed: %v", err)
		}

		// Create Snapshot 2 with this project present
		reqSnap2 := httptest.NewRequest(http.MethodPost, "/api/v1/backups/snapshot", nil)
		wSnap2 := httptest.NewRecorder()
		router.ServeHTTP(wSnap2, reqSnap2)
		if wSnap2.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for snapshot 2, got %d: %s", wSnap2.Code, wSnap2.Body.String())
		}
		var resp2 struct {
			Snapshot ClusterBackupSnapshot `json:"snapshot"`
		}
		_ = json.NewDecoder(wSnap2.Body).Decode(&resp2)
		snap2ID := resp2.Snapshot.ID

		// Now delete the project to simulate accidental data loss
		_ = orch.Queries().DeleteProject(ctx, proj.ID)
		_, errCheck := orch.Queries().GetProjectByID(ctx, proj.ID)
		if errCheck == nil {
			t.Fatalf("expected project to be deleted")
		}

		// Restore from Snapshot 2
		restoreBody, _ := json.Marshal(map[string]string{
			"snapshotId": snap2ID,
		})
		reqRestore := httptest.NewRequest(http.MethodPost, "/api/v1/backups/restore", bytes.NewReader(restoreBody))
		reqRestore.Header.Set("Content-Type", "application/json")
		wRestore := httptest.NewRecorder()
		router.ServeHTTP(wRestore, reqRestore)

		if wRestore.Code != http.StatusOK {
			t.Fatalf("expected 200 OK for restore, got %d: %s", wRestore.Code, wRestore.Body.String())
		}

		var restoreResp struct {
			OK      bool   `json:"ok"`
			Message string `json:"message"`
		}
		if err := json.NewDecoder(wRestore.Body).Decode(&restoreResp); err != nil {
			t.Fatalf("failed to decode restore response: %v", err)
		}
		if !restoreResp.OK {
			t.Errorf("expected restore ok=true")
		}

		// Verify project has been restored back into DB!
		restoredProj, errRestored := orch.Queries().GetProjectByID(ctx, proj.ID)
		if errRestored != nil {
			t.Fatalf("project was not restored: %v", errRestored)
		}
		if restoredProj.Name != "Backup Test Project" {
			t.Errorf("expected project name 'Backup Test Project', got '%s'", restoredProj.Name)
		}
	})

	// 6. Restore with invalid or empty ID
	t.Run("Restore_Validation_Errors", func(t *testing.T) {
		// Empty body
		reqEmpty := httptest.NewRequest(http.MethodPost, "/api/v1/backups/restore", bytes.NewReader([]byte("{}")))
		reqEmpty.Header.Set("Content-Type", "application/json")
		wEmpty := httptest.NewRecorder()
		router.ServeHTTP(wEmpty, reqEmpty)
		if wEmpty.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request for empty snapshotId, got %d", wEmpty.Code)
		}

		// Non-existent ID
		reqNonExistent := httptest.NewRequest(http.MethodPost, "/api/v1/backups/restore", bytes.NewReader([]byte(`{"snapshotId":"snap-non-existent"}`)))
		reqNonExistent.Header.Set("Content-Type", "application/json")
		wNonExistent := httptest.NewRecorder()
		router.ServeHTTP(wNonExistent, reqNonExistent)
		if wNonExistent.Code != http.StatusInternalServerError {
			t.Errorf("expected 500 for missing snapshot, got %d", wNonExistent.Code)
		}
	})
}
