import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ProjectDetailPage from "../page"
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

describe("ProjectDetailPage", () => {
  it("renders ProjectDetailPage skeleton initially or resolves params cleanly", () => {
    const html = renderToString(
      <ProjectDetailPage params={{ id: "prj_acme" }} />
    )

    expect(html).toContain("Back to Projects")
    expect(html).not.toContain("—")
  })

  it("fetches project details and its child services from MockApiClient", async () => {
    resetApiClient()

    const projectDetail = await api.projects.get("prj_acme")
    expect(projectDetail.id).toBe("prj_acme")
    expect(projectDetail.name).toBe("Acme Platform")
    expect(projectDetail.services.length).toBeGreaterThanOrEqual(1)

    const services = await api.services.list({ projectId: "prj_acme" })
    expect(services.length).toBeGreaterThanOrEqual(1)
    expect(services[0].project_id).toBe("prj_acme")
  })

  it("triggers mutations (restart, stop, rebuild) on services via MockApiClient", async () => {
    resetApiClient()

    // Test restart
    const restarted = await api.services.restart("srv_web_prod")
    expect(restarted.status).toBe("running")

    // Test stop
    const stopped = await api.services.stop("srv_web_prod")
    expect(stopped.status).toBe("stopped")

    // Test start
    const started = await api.services.start("srv_web_prod")
    expect(started.status).toBe("running")

    // Test rebuild
    const deployment = await api.services.rebuild("srv_web_prod")
    expect(deployment.id).toBeDefined()
    expect(deployment.service_id).toBe("srv_web_prod")

    // Test delete
    const tempService = await api.services.create({
      project_id: "prj_acme",
      server_id: "srv_local",
      name: "to-be-deleted-service",
      service_type: "web",
      repository: "acme/test-repo",
      branch: "main",
      dockerfile_path: "Dockerfile",
      internal_port: 3000,
      health_check_path: "/",
    })
    await api.services.delete(tempService.id)

    const remainingServices = await api.services.list({ projectId: "prj_acme" })
    expect(remainingServices.some((s) => s.id === tempService.id)).toBe(false)
  })
})
