-- name: ListProjects :many
SELECT * FROM projects ORDER BY created_at DESC;

-- name: GetProjectByID :one
SELECT * FROM projects WHERE id = ? LIMIT 1;

-- name: GetProjectBySlug :one
SELECT * FROM projects WHERE slug = ? LIMIT 1;

-- name: CreateProject :one
INSERT INTO projects (
    id, name, slug, description, environment, status, tags
) VALUES (
    ?, ?, ?, ?, ?, ?, ?
) RETURNING *;

-- name: UpdateProjectStatus :exec
UPDATE projects SET
    status = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: DeleteProject :exec
DELETE FROM projects WHERE id = ?;
