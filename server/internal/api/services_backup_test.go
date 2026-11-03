package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"gettako.dev/tako/internal/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestServiceBackupEndpoints(t *testing.T) {
	router, _ := setupTestRouter(t)

	// 1. Create a project and service to test with
	projBody := `{"name":"Backup Project","slug":"backup-proj"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/projects", bytes.NewBufferString(projBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusCreated, rec.Code)

	var projResp struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &projResp))

	srvBody := `{"projectId":"` + projResp.ID + `","name":"Test App","slug":"test-app","type":"application","ports":[80]}`
	req = httptest.NewRequest(http.MethodPost, "/api/v1/services", bytes.NewBufferString(srvBody))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusCreated, rec.Code)

	var srvResp struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &srvResp))
	srvID := srvResp.ID

	// 2. GET default service backup configurations
	req = httptest.NewRequest(http.MethodGet, "/api/v1/services/"+srvID+"/backup", nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)

	var configs []api.ServiceBackupConfig
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &configs))
	require.NotEmpty(t, configs)
	assert.False(t, configs[0].Enabled)
	assert.Equal(t, "0 2 * * *", configs[0].CronSchedule)
	assert.Equal(t, "services/test-app/backups/", configs[0].Prefix)

	// 3. PUT updated multi-backup configuration (e.g. Postgres + Redis)
	updateBody := `[
		{
			"id": "backup-postgres",
			"name": "Postgres Daily",
			"enabled": true,
			"cronSchedule": "0 2 * * *",
			"targetContainer": "tako-app-test-app-postgres",
			"databaseType": "postgres",
			"databaseName": "production_db",
			"databaseUser": "postgres_user",
			"retentionDays": 14,
			"destinationBucketId": "s3-custom-bucket",
			"prefix": "custom/test-app/postgres/"
		},
		{
			"id": "backup-redis",
			"name": "Redis Weekly",
			"enabled": true,
			"cronSchedule": "0 3 * * 0",
			"targetContainer": "tako-app-test-app-redis",
			"databaseType": "redis",
			"retentionDays": 7,
			"destinationBucketId": "s3-custom-bucket",
			"prefix": "custom/test-app/redis/"
		}
	]`
	req = httptest.NewRequest(http.MethodPut, "/api/v1/services/"+srvID+"/backup", bytes.NewBufferString(updateBody))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)

	var updatedConfigs []api.ServiceBackupConfig
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &updatedConfigs))
	require.Len(t, updatedConfigs, 2)
	assert.Equal(t, "Postgres Daily", updatedConfigs[0].Name)
	assert.Equal(t, "postgres", updatedConfigs[0].DatabaseType)
	assert.Equal(t, "Redis Weekly", updatedConfigs[1].Name)
	assert.Equal(t, "redis", updatedConfigs[1].DatabaseType)

	// 4. Trigger manual on-demand backup snapshot for specific container config
	triggerBody := `{"backupId":"backup-postgres"}`
	req = httptest.NewRequest(http.MethodPost, "/api/v1/services/"+srvID+"/backup", bytes.NewBufferString(triggerBody))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)

	var triggerResp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &triggerResp))
	assert.True(t, triggerResp["ok"].(bool))
	assert.NotEmpty(t, triggerResp["filename"])
	assert.NotEmpty(t, triggerResp["checksum"])
	assert.Equal(t, "Postgres Daily", triggerResp["planName"])
}
