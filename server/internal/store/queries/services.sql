-- name: ListAllServices :many
SELECT * FROM services ORDER BY created_at DESC;

-- name: ListServicesByProject :many
SELECT * FROM services WHERE project_id = ? ORDER BY created_at DESC;

-- name: ListServicesByNode :many
SELECT * FROM services WHERE node_id = ? ORDER BY created_at DESC;

-- name: GetServiceByID :one
SELECT * FROM services WHERE id = ? LIMIT 1;

-- name: CreateService :one
INSERT INTO services (
    id, project_id, node_id, name, slug, type, status,
    repository, branch, commit_hash, dockerfile, build_command,
    compose_file, image, database_type, database_version,
    connection_string, ports, replicas, cpu_limit, memory_limit_mb,
    publish_to_host
) VALUES (
    ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?
) RETURNING *;

-- name: UpdateServiceStatus :exec
UPDATE services SET
    status = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: DeleteService :exec
DELETE FROM services WHERE id = ?;

-- name: ListServiceDomains :many
SELECT * FROM service_domains WHERE service_id = ?;

-- name: CreateServiceDomain :one
INSERT INTO service_domains (
    id, service_id, domain, ssl, is_primary, port, path, certificate_type
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: DeleteServiceDomains :exec
DELETE FROM service_domains WHERE service_id = ?;

-- name: ListServiceEnvVars :many
SELECT * FROM service_env_vars WHERE service_id = ?;

-- name: CreateServiceEnvVar :one
INSERT INTO service_env_vars (
    id, service_id, key, value, is_secret
) VALUES (
    ?, ?, ?, ?, ?
) RETURNING *;

-- name: DeleteServiceEnvVars :exec
DELETE FROM service_env_vars WHERE service_id = ?;
