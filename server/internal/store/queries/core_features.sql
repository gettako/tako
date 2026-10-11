-- name: ListProjectEnvVars :many
SELECT * FROM project_env_vars WHERE project_id = ? ORDER BY key ASC;

-- name: CreateProjectEnvVar :one
INSERT INTO project_env_vars (
    id, project_id, key, value, is_secret
) VALUES (
    ?, ?, ?, ?, ?
) RETURNING *;

-- name: DeleteProjectEnvVars :exec
DELETE FROM project_env_vars WHERE project_id = ?;

-- name: DeleteProjectEnvVarByKey :exec
DELETE FROM project_env_vars WHERE project_id = ? AND key = ?;

-- name: ListCronJobsByService :many
SELECT * FROM cron_jobs WHERE service_id = ? ORDER BY created_at DESC;

-- name: ListAllActiveCronJobs :many
SELECT * FROM cron_jobs WHERE status = 'active' ORDER BY created_at ASC;

-- name: GetCronJobByID :one
SELECT * FROM cron_jobs WHERE id = ? LIMIT 1;

-- name: CreateCronJob :one
INSERT INTO cron_jobs (
    id, service_id, name, schedule, command, status
) VALUES (
    ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: UpdateCronJob :one
UPDATE cron_jobs SET
    name = ?,
    schedule = ?,
    command = ?,
    status = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?
RETURNING *;

-- name: UpdateCronJobStatus :exec
UPDATE cron_jobs SET
    status = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: DeleteCronJob :exec
DELETE FROM cron_jobs WHERE id = ?;

-- name: ListCronJobRuns :many
SELECT * FROM cron_job_runs WHERE cron_job_id = ? ORDER BY started_at DESC LIMIT 50;

-- name: CreateCronJobRun :one
INSERT INTO cron_job_runs (
    id, cron_job_id, status, exit_code, output, started_at
) VALUES (
    ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
) RETURNING *;

-- name: UpdateCronJobRun :exec
UPDATE cron_job_runs SET
    status = ?,
    exit_code = ?,
    output = ?,
    finished_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: ListRegistries :many
SELECT * FROM registries ORDER BY created_at DESC;

-- name: GetRegistryByID :one
SELECT * FROM registries WHERE id = ? LIMIT 1;

-- name: CreateRegistry :one
INSERT INTO registries (
    id, name, server_url, username, password
) VALUES (
    ?, ?, ?, ?, ?
) RETURNING *;

-- name: DeleteRegistry :exec
DELETE FROM registries WHERE id = ?;

-- name: GetNodeRetentionPolicy :one
SELECT * FROM node_retention_policies WHERE node_id = ? LIMIT 1;

-- name: UpsertNodeRetentionPolicy :one
INSERT INTO node_retention_policies (
    node_id, keep_image_versions, auto_prune_threshold_percent, prune_build_cache, updated_at
) VALUES (
    ?, ?, ?, ?, CURRENT_TIMESTAMP
) ON CONFLICT(node_id) DO UPDATE SET
    keep_image_versions = excluded.keep_image_versions,
    auto_prune_threshold_percent = excluded.auto_prune_threshold_percent,
    prune_build_cache = excluded.prune_build_cache,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;
