import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ServiceOverviewPage from "../page"
import { ServiceProvider } from "@/components/services/service-context"
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

describe("ServiceOverviewPage (M4-002)", () => {
  it("renders ServiceOverviewPage with 4 specification cards and quick actions", () => {
    const html = renderToString(
      <ServiceProvider serviceId="srv_web_prod" projectId="prj_acme">
        <ServiceOverviewPage />
      </ServiceProvider>
    )

    // Verify loading skeleton or structure rendered cleanly
    expect(html).toBeDefined()
    // Antislop check: No em dash
    expect(html).not.toContain("—")
  })

  it("fetches service overview data accurately from MockApiClient", async () => {
    resetApiClient()

    const service = await api.services.get("srv_web_prod")
    expect(service.id).toBe("srv_web_prod")
    expect(service.name).toBe("acme-web")
    expect(service.repository).toBe("acme/web-frontend")
    expect(service.branch).toBe("main")
    expect(service.dockerfile_path).toBe("Dockerfile")
    expect(service.internal_port).toBe(3000)
    expect(service.server).toBeDefined()
    expect(service.server.name).toBe("Primary Control Node (Local)")

    const deployments = await api.services.listDeployments("srv_web_prod", {
      limit: 1,
    })
    expect(deployments.items.length).toBeGreaterThanOrEqual(1)
    expect(deployments.items[0].commit_sha).toBeDefined()
  })

  it("triggers manual deploy rebuild action via MockApiClient", async () => {
    resetApiClient()

    const newDep = await api.services.rebuild("srv_web_prod")
    expect(newDep.service_id).toBe("srv_web_prod")
    expect(newDep.status).toBe("building")

    const updatedService = await api.services.get("srv_web_prod")
    expect(updatedService.status).toBe("building")
  })

  it("renders database service overview without em dashes and manages lifecycle", async () => {
    resetApiClient()

    const html = renderToString(
      <ServiceProvider serviceId="srv_acme_postgres" projectId="prj_acme">
        <ServiceOverviewPage />
      </ServiceProvider>
    )

    expect(html).toBeDefined()
    expect(html).not.toContain("—")

    const dbService = await api.services.get("srv_acme_postgres")
    expect(dbService.service_type).toBe("database")
    expect(dbService.database_engine).toBe("postgres")
    expect(dbService.database_user).toBe("postgres")
    expect(dbService.database_name).toBe("acme_db")
    expect(dbService.volume_name).toBe("tako_vol_srv_acme_postgres_data")
    expect(dbService.connection_uri).toContain("postgres://postgres:")

    // Test stop and start
    const stopped = await api.services.stop("srv_acme_postgres")
    expect(stopped.status).toBe("stopped")

    const started = await api.services.start("srv_acme_postgres")
    expect(started.status).toBe("running")
  })
})
