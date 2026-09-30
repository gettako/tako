import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { ComposeServiceOverview } from "../compose-service-overview"
import { api, resetApiClient, type ServiceDetail } from "@/lib/api"
import { mockServers } from "@/lib/api/fixtures/servers"
import { mockProjects } from "@/lib/api/fixtures/projects"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme/services/srv_compose_1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ComposeServiceOverview Component (M14-009)", () => {
  const dummyService: ServiceDetail = {
    id: "srv_compose_1",
    project_id: "prj_acme",
    server_id: "srv_local",
    name: "acme-compose-stack",
    service_type: "compose",
    status: "running",
    repository: "inline/compose",
    branch: "main",
    dockerfile_path: "Dockerfile",
    internal_port: 80,
    health_check_path: "/healthz",
    compose_file_content:
      "version: '3.8'\nservices:\n  web:\n    image: nginx:alpine",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    server: mockServers[0],
    project: mockProjects[0],
    domains: [],
    active_deployment: null,
    env_vars_count: 0,
  }

  it("renders ComposeServiceOverview layout cleanly without errors and zero em dashes", () => {
    const html = renderToString(
      <ComposeServiceOverview
        service={dummyService}
        serviceId={dummyService.id}
        projectId={dummyService.project_id}
        refetch={async () => {}}
        showToast={() => {}}
      />
    )

    expect(html).toContain("acme-compose-stack")
    expect(html).toContain("Docker Compose Stack")
    expect(html).toContain("Isolated Internal Network")
    expect(html).toContain("Sub-Containers")
    expect(html).toContain("Compose Live Log Stream")
    expect(html).toContain("All Containers")
    expect(html).not.toContain("—")
  })

  it("fetches stack overview and sub-containers from MockApiClient", async () => {
    resetApiClient()

    // 1. Create compose service in mock
    const created = await api.services.create({
      project_id: "prj_acme",
      server_id: "srv_local",
      name: "stack-test",
      service_type: "compose",
      compose_file_content:
        "version: '3.8'\nservices:\n  web:\n    image: nginx\n  db:\n    image: postgres",
      repository: "inline/compose",
      branch: "main",
      dockerfile_path: "Dockerfile",
      internal_port: 80,
      health_check_path: "/healthz",
    })

    // 2. Fetch stack overview
    const overview = await api.services.getStackOverview(created.id)
    expect(overview.service_id).toBe(created.id)
    expect(overview.network_name).toBe("tako_compose_prj_acme")
    expect(overview.sub_services.length).toBe(2)

    const webSub = overview.sub_services.find((s) => s.name === "web")
    expect(webSub).toBeDefined()
    expect(webSub?.status).toBe("running")
    expect(webSub?.ports?.length).toBeGreaterThanOrEqual(1)

    const dbSub = overview.sub_services.find((s) => s.name === "db")
    expect(dbSub).toBeDefined()
    expect(dbSub?.status).toBe("running")
  })

  it("streams container runtime logs with container filtering", async () => {
    resetApiClient()

    // Stream all containers
    const allStream = api.services.streamContainerLogs("srv_compose_1")
    let count = 0
    for await (const chunk of allStream) {
      expect(chunk.line).toBeDefined()
      count++
      if (count >= 5) break
    }
    expect(count).toBeGreaterThan(0)

    // Stream specific sub-service container
    const webStream = api.services.streamContainerLogs("srv_compose_1", {
      container: "web",
    })
    for await (const chunk of webStream) {
      if (chunk.container_name) {
        expect(chunk.container_name).toBe("web")
      }
      break
    }
  })
})
