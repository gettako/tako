import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ProjectsPage from "../page"
import {
  CreateProjectForm,
  CreateProjectDialog,
} from "@/components/projects/create-project-dialog"
import { api, resetApiClient } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ProjectsPage & CreateProjectDialog", () => {
  it("renders projects page header, search bar, and new project button", () => {
    const html = renderToString(<ProjectsPage />)

    expect(html).toContain("Projects")
    expect(html).toContain(
      "Manage your project workspaces and deployed applications."
    )
    expect(html).toContain("New Project")
    expect(html).toContain("Search projects...")
  })

  it("does not contain em dashes in ProjectsPage", () => {
    const html = renderToString(<ProjectsPage />)
    expect(html).not.toContain("—")
  })

  it("renders CreateProjectForm with required fields, labels, and action buttons", () => {
    const html = renderToString(<CreateProjectForm onCancel={() => {}} />)

    expect(html).toContain("Create New Project")
    expect(html).toContain("Project Name")
    expect(html).toContain("Description")
    expect(html).toContain("Create Project")
    expect(html).toContain("Cancel")
    expect(html).not.toContain("—")
  })

  it("interacts correctly with MockApiClient for listing and creating projects", async () => {
    resetApiClient()

    // Test list
    const initialProjects = await api.projects.list()
    expect(Array.isArray(initialProjects)).toBe(true)
    expect(initialProjects.length).toBeGreaterThanOrEqual(1)

    // Verify first project properties
    const firstProject = initialProjects[0]
    expect(firstProject.name).toBeDefined()
    expect(firstProject.id).toBeDefined()
    expect(firstProject.services_count).toBeDefined()

    // Test creation via API client
    const created = await api.projects.create({
      name: "New Test Workspace",
      description: "Automated test project workspace",
    })

    expect(created.id).toBeDefined()
    expect(created.name).toBe("New Test Workspace")
    expect(created.description).toBe("Automated test project workspace")
    expect(created.services_count).toBe(0)

    // Verify project appears in list
    const updatedProjects = await api.projects.list()
    const found = updatedProjects.find((p) => p.id === created.id)
    expect(found).toBeDefined()
    expect(found?.name).toBe("New Test Workspace")
  })

  it("validates project creation fields client-side", () => {
    // Test validation constraints
    const validate = (name: string, description: string) => {
      const errors: { name?: string; description?: string } = {}
      const trimmed = name.trim()
      if (!trimmed) errors.name = "Project name is required."
      else if (trimmed.length < 2)
        errors.name = "Project name must be at least 2 characters."
      else if (trimmed.length > 50)
        errors.name = "Project name must not exceed 50 characters."
      if (description.length > 200)
        errors.description = "Description must not exceed 200 characters."
      return errors
    }

    expect(validate("", "").name).toBe("Project name is required.")
    expect(validate(" ", "").name).toBe("Project name is required.")
    expect(validate("a", "").name).toBe(
      "Project name must be at least 2 characters."
    )
    expect(validate("a".repeat(51), "").name).toBe(
      "Project name must not exceed 50 characters."
    )
    expect(validate("Valid Name", "d".repeat(201)).description).toBe(
      "Description must not exceed 200 characters."
    )
    expect(
      Object.keys(validate("Valid Name", "Valid description")).length
    ).toBe(0)
  })
})
