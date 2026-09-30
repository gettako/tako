import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import DashboardMonitorPage from "../page"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { api, resetApiClient } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("DashboardMonitorPage & Cluster Monitor (M6-000)", () => {
  it("renders dashboard loading skeleton or initial layout without errors and zero em dashes", () => {
    const html = renderToString(<DashboardMonitorPage />)
    expect(html).not.toContain("—")
  })

  it("primary app sidebar contains Dashboard link pointing to / above Projects", () => {
    const html = renderToString(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    )

    expect(html).toContain("Dashboard")
    expect(html).toContain('href="/"')
    expect(html).toContain("Projects")
    expect(html).toContain('href="/projects"')

    // Verify Dashboard appears before Projects in HTML
    const dashboardIndex = html.indexOf('href="/"')
    const projectsIndex = html.indexOf('href="/projects"')
    expect(dashboardIndex).toBeGreaterThan(-1)
    expect(projectsIndex).toBeGreaterThan(-1)
    expect(dashboardIndex).toBeLessThan(projectsIndex)
  })

  it("fetches servers, projects, and services accurately from MockApiClient for cluster metrics", async () => {
    resetApiClient()

    const [servers, projects, services] = await Promise.all([
      api.servers.list(),
      api.projects.list(),
      api.services.list(),
    ])

    expect(servers.length).toBeGreaterThanOrEqual(1)
    expect(projects.length).toBeGreaterThanOrEqual(1)
    expect(services.length).toBeGreaterThanOrEqual(1)

    // Verify server resource telemetry
    for (const server of servers) {
      expect(typeof server.cpu_percent).toBe("number")
      expect(typeof server.ram_percent).toBe("number")
      expect(typeof server.disk_percent).toBe("number")
      expect(["online", "offline", "pending"]).toContain(server.status)
    }

    // Verify services have statuses
    for (const service of services) {
      expect(service.status).toBeDefined()
    }
  })

  it("fetches recent deployments across services via listDeployments", async () => {
    resetApiClient()

    const services = await api.services.list()
    const targetService = services[0]
    expect(targetService).toBeDefined()

    const deployments = await api.services.listDeployments(targetService.id, {
      limit: 5,
    })

    expect(Array.isArray(deployments.items)).toBe(true)
    if (deployments.items.length > 0) {
      const dep = deployments.items[0]
      expect(dep.id).toBeDefined()
      expect(dep.commit_sha).toBeDefined()
      expect(dep.branch).toBeDefined()
      expect(dep.status).toBeDefined()
    }
  })

  it("renders Cluster Telemetry History with zero em dashes and zero shadows", () => {
    const html = renderToString(<DashboardMonitorPage />)
    expect(html).not.toContain("—")
    expect(html).not.toContain("box-shadow")
  })
})
