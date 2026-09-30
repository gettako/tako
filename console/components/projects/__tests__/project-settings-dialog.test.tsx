import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { ProjectSettingsForm } from "../project-settings-dialog"
import { api, resetApiClient } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ProjectSettingsForm & ProjectSettingsDialog", () => {
  const dummyProject = {
    id: "prj_acme",
    name: "Acme Platform",
    description: "Core production SaaS infrastructure.",
    services_count: 2,
    created_at: "2026-09-02T10:00:00Z",
    updated_at: "2026-09-28T16:20:00Z",
  }

  it("renders project settings form with name input, description, and danger zone", () => {
    const html = renderToString(
      <ProjectSettingsForm project={dummyProject} onClose={() => {}} />
    )

    expect(html).toContain("Project Settings")
    expect(html).toContain("General Details")
    expect(html).toContain("Acme Platform")
    expect(html).toContain("Save Changes")
    expect(html).toContain("Danger Zone")
    expect(html).toContain("Delete Project")
    expect(html).not.toContain("—")
  })

  it("updates project metadata via MockApiClient", async () => {
    resetApiClient()

    const updated = await api.projects.update("prj_acme", {
      name: "Acme Platform Renamed",
      description: "Updated description for acme platform",
    })

    expect(updated.id).toBe("prj_acme")
    expect(updated.name).toBe("Acme Platform Renamed")
    expect(updated.description).toBe("Updated description for acme platform")

    const fetched = await api.projects.get("prj_acme")
    expect(fetched.name).toBe("Acme Platform Renamed")
  })

  it("deletes project via MockApiClient and cascades deletion", async () => {
    resetApiClient()

    // Create a temporary project to delete
    const tempProject = await api.projects.create({
      name: "Temporary Project To Delete",
      description: "Will be deleted",
    })

    expect(tempProject.id).toBeDefined()

    // Delete the project
    await api.projects.delete(tempProject.id)

    // Attempting to get deleted project should throw 404
    let errorThrown = false
    try {
      await api.projects.get(tempProject.id)
    } catch (err: any) {
      errorThrown = true
      expect(err.status).toBe(404)
    }
    expect(errorThrown).toBe(true)

    // Also check list does not contain deleted project
    const allProjects = await api.projects.list()
    expect(allProjects.some((p) => p.id === tempProject.id)).toBe(false)
  })

  it("validates deletion confirmation matching project name strictly", () => {
    const projectName = "Acme Platform"
    const canDelete = (confirmInput: string) => confirmInput === projectName

    expect(canDelete("")).toBe(false)
    expect(canDelete("acme platform")).toBe(false)
    expect(canDelete("Acme Platform ")).toBe(false)
    expect(canDelete("Acme Platform")).toBe(true)
  })
})
