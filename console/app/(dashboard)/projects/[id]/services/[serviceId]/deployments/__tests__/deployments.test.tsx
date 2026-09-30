import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ServiceDeploymentsPage from "../page"
import {
  BuildLogPanel,
  BuildLogModal,
} from "@/components/services/build-log-modal"
import { ServiceProvider } from "@/components/services/service-context"
import { api, resetApiClient, type Deployment } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme/services/srv_web_prod/deployments",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ServiceDeploymentsPage & BuildLogModal (M4-003 & M4-004)", () => {
  it("renders ServiceDeploymentsPage layout without errors and with zero em dashes", () => {
    const html = renderToString(
      <ServiceProvider serviceId="srv_web_prod" projectId="prj_acme">
        <ServiceDeploymentsPage />
      </ServiceProvider>
    )

    expect(html).toBeDefined()
    expect(html).not.toContain("—")
  })

  it("fetches deployment history from MockApiClient accurately", async () => {
    resetApiClient()

    const res = await api.services.listDeployments("srv_web_prod", {
      limit: 10,
    })
    expect(res.items.length).toBeGreaterThanOrEqual(1)
    expect(res.items[0].service_id).toBe("srv_web_prod")
    expect(res.items[0].commit_sha).toBeDefined()
    expect(res.items[0].branch).toBeDefined()
  })

  it("triggers manual deploy on branch via MockApiClient", async () => {
    resetApiClient()

    const created = await api.services.createDeployment("srv_web_prod", {
      branch: "main",
      commit_sha: "testsha123",
    })
    expect(created.service_id).toBe("srv_web_prod")
    expect(created.branch).toBe("main")
    expect(created.commit_sha).toBe("testsha123")
  })

  it("executes rollback on previous deployment via MockApiClient", async () => {
    resetApiClient()

    const rollback = await api.services.rollbackDeployment(
      "srv_web_prod",
      "dep_001"
    )
    expect(rollback.service_id).toBe("srv_web_prod")
    expect(rollback.status).toBe("success")
  })

  it("renders BuildLogPanel and streams live build logs via SSE mock", async () => {
    resetApiClient()

    const mockDeployment: Deployment = {
      id: "dep_001",
      service_id: "srv_web_prod",
      status: "building",
      commit_sha: "abc1234",
      commit_message: "Test commit",
      commit_author: "Alice",
      branch: "main",
      image_tag: "tako-app:dep_001",
      started_at: new Date().toISOString(),
      finished_at: null,
      duration_seconds: 30,
      created_at: new Date().toISOString(),
    }

    const panelHtml = renderToString(
      <BuildLogPanel serviceId="srv_web_prod" deployment={mockDeployment} />
    )

    expect(panelHtml).toContain("Build Logs")
    expect(panelHtml).toContain("abc1234")
    expect(panelHtml).toContain("Cancel Build")
    expect(panelHtml).not.toContain("—")

    // Test streamBuildLogs directly
    const stream = api.services.streamBuildLogs("srv_web_prod", "dep_001")
    const chunks = []
    for await (const chunk of stream) {
      chunks.push(chunk)
      if (chunks.length >= 3) break
    }
    expect(chunks.length).toBeGreaterThanOrEqual(3)

    // Test cancelDeployment
    const cancelled = await api.services.cancelDeployment(
      "srv_web_prod",
      "dep_001"
    )
    expect(cancelled.status).toBe("cancelled")
  })

  it("fetches preview environments and allows destroying preview via MockApiClient", async () => {
    resetApiClient()

    const previews = await api.services.listPreviews("srv_web_prod")
    expect(previews.length).toBeGreaterThanOrEqual(2)
    expect(previews[0].service_id).toBe("srv_web_prod")
    expect(previews[0].pr_number).toBe(42)
    expect(previews[0].url).toBe("https://42.myapp.gettako.dev")
    expect(previews[1].url).toContain("sslip.io")

    await api.services.deletePreview("srv_web_prod", previews[0].id)
    const afterDelete = await api.services.listPreviews("srv_web_prod")
    expect(afterDelete.find((p) => p.id === previews[0].id)).toBeUndefined()
  })

  it("renders ServiceDeploymentsPage with Previews sub-tab trigger", () => {
    const html = renderToString(
      <ServiceProvider serviceId="srv_web_prod" projectId="prj_acme">
        <ServiceDeploymentsPage />
      </ServiceProvider>
    )

    expect(html).toContain("All Deployments")
    expect(html).toContain("Previews")
    expect(html).not.toContain("—")
  })
})
