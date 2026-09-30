import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ServiceLayout from "../layout"
import { api, resetApiClient } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme/services/srv_web_prod",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ServiceLayout & Header Tabs (M4-001)", () => {
  it("renders ServiceLayout and tab navigation bar with 5 tabs", () => {
    const html = renderToString(
      <ServiceLayout params={{ id: "prj_acme", serviceId: "srv_web_prod" }}>
        <div>Child Tab Content</div>
      </ServiceLayout>
    )

    expect(html).toContain("Back to Project")
    expect(html).toContain("Overview")
    expect(html).toContain("Deployments")
    expect(html).toContain("Domains")
    expect(html).toContain("Monitoring")
    expect(html).toContain("Environment")
    expect(html).toContain("Child Tab Content")
    // Antislop check: No em dash
    expect(html).not.toContain("—")
  })

  it("renders Redeploy button for git services and Pull Latest & Recreate for database services", () => {
    const htmlWeb = renderToString(
      <ServiceLayout
        params={{ id: "prj_acme", serviceId: "srv_web_prod" }}
        initialService={{
          id: "srv_web_prod",
          name: "acme-web",
          service_type: "web",
          status: "running",
          server: { id: "srv_local", name: "Primary Node" },
        }}
      >
        <div>Content</div>
      </ServiceLayout>
    )
    expect(htmlWeb).toContain("Redeploy")
    expect(htmlWeb).not.toContain("—")

    const htmlDb = renderToString(
      <ServiceLayout
        params={{ id: "prj_acme", serviceId: "srv_acme_postgres" }}
        initialService={{
          id: "srv_acme_postgres",
          name: "acme-postgres",
          service_type: "database",
          database_engine: "postgres",
          database_version: "16-alpine",
          status: "running",
          server: { id: "srv_local", name: "Primary Node" },
        }}
      >
        <div>Content</div>
      </ServiceLayout>
    )
    expect(htmlDb).toContain("Pull Latest")
    expect(htmlDb).toContain("Recreate")
    expect(htmlDb).not.toContain("—")
  })

  it("interacts correctly with MockApiClient for service details, rebuild, and lifecycle", async () => {
    resetApiClient()

    // 1. Fetch service detail
    const service = await api.services.get("srv_web_prod")
    expect(service.id).toBe("srv_web_prod")
    expect(service.name).toBe("acme-web")
    expect(service.status).toBe("running")
    expect(service.server).toBeDefined()
    expect(service.server.name).toBe("Primary Control Node (Local)")

    // 2. Action: Rebuild
    const dep = await api.services.rebuild("srv_web_prod")
    expect(dep.service_id).toBe("srv_web_prod")
    expect(dep.status).toBe("building")

    // 3. Action: Stop
    const stopped = await api.services.stop("srv_web_prod")
    expect(stopped.status).toBe("stopped")

    // 4. Action: Restart / Start
    const restarted = await api.services.restart("srv_web_prod")
    expect(restarted.status).toBe("running")

    // 5. Update service name
    const updated = await api.services.update("srv_web_prod", {
      name: "Renamed Marketing App",
    })
    expect(updated.name).toBe("Renamed Marketing App")

    // 6. Action: Delete service
    const toDelete = await api.services.create({
      project_id: "prj_acme",
      server_id: "srv_local",
      name: "service-to-delete-layout-test",
      service_type: "web",
      repository: "acme/repo",
      branch: "main",
      dockerfile_path: "Dockerfile",
      internal_port: 3000,
      health_check_path: "/",
    })
    await api.services.delete(toDelete.id)
    const listAfterDelete = await api.services.list({ projectId: "prj_acme" })
    expect(listAfterDelete.some((s) => s.id === toDelete.id)).toBe(false)
  })

  it("handles status SSE stream correctly", async () => {
    resetApiClient()

    const stream = api.services.streamStatus("srv_web_prod")
    const events = []
    for await (const event of stream) {
      events.push(event)
      if (events.length >= 2) break
    }

    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events[0].service_id).toBe("srv_web_prod")
  })
})
