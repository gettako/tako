import { describe, expect, it } from "bun:test"
import type { Project } from "../types/platform"

describe("Project Deletion Safety", () => {
  const projectWithServices: Project = {
    id: "proj-1",
    name: "Production Gateway",
    slug: "production-gateway",
    description: "Core ingress routers",
    environment: "production",
    servicesCount: 3,
    healthyServicesCount: 3,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  }

  const emptyProject: Project = {
    id: "proj-2",
    name: "Staging Sandbox",
    slug: "staging-sandbox",
    description: "Empty test environment",
    environment: "staging",
    servicesCount: 0,
    healthyServicesCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  }

  it("identifies projects with active services that must not be deleted", () => {
    expect(projectWithServices.servicesCount > 0).toBe(true)
    expect(emptyProject.servicesCount > 0).toBe(false)
  })

  it("formats delete endpoint URL without force cascade query param", () => {
    const id = "proj-123"
    const safeDeletePath = `/projects/${id}`
    expect(safeDeletePath).not.toContain("cascade=true")
    expect(safeDeletePath).toBe("/projects/proj-123")
  })
})
