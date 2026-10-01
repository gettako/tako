import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ServiceSettingsPage from "../page"
import { ServiceProvider } from "@/components/services/service-context"
import { api, resetApiClient } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme/services/srv_web_prod/settings",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ServiceSettingsPage", () => {
  it("renders ServiceSettingsPage cleanly with zero em dashes and zero shadows", () => {
    const html = renderToString(
      <ServiceProvider serviceId="srv_web_prod" projectId="prj_acme">
        <ServiceSettingsPage />
      </ServiceProvider>
    )

    expect(html).toBeDefined()
    expect(html).not.toContain("—")
    expect(html).not.toContain("shadow-lg")
    expect(html).not.toContain("shadow-md")
    expect(html).not.toContain("shadow-sm")
  })

  it("renders deployment triggers and webhook setup when service is loaded", async () => {
    resetApiClient()
    const service = await api.services.get("srv_web_prod")
    const html = renderToString(
      <ServiceProvider
        serviceId="srv_web_prod"
        projectId="prj_acme"
        initialService={service}
      >
        <ServiceSettingsPage />
      </ServiceProvider>
    )

    expect(html).toBeDefined()
    expect(html).not.toContain("—")
    expect(html).not.toContain("shadow-lg")
    expect(html).not.toContain("shadow-md")
    expect(html).not.toContain("shadow-sm")
    expect(html).toContain("Deployment Triggers")
    expect(html).toContain("Trigger on git push")
    expect(html).toContain("Trigger on git tag")
    expect(html).toContain("Webhook Setup for GitHub")
    expect(html).toContain("/api/services/srv_web_prod/webhook")
  })

  it("updates service configuration via MockApiClient", async () => {
    resetApiClient()

    const initial = await api.services.get("srv_web_prod")
    expect(initial.name).toBe("acme-web")
    expect(initial.internal_port).toBe(3000)

    const updated = await api.services.update("srv_web_prod", {
      name: "acme-web-v2",
      branch: "develop",
      internal_port: 8080,
      health_check_path: "/health",
      pre_deploy_command: "npm run test",
      post_deploy_command: "npm run notify",
      auto_deploy: true,
    })

    expect(updated.name).toBe("acme-web-v2")
    expect(updated.branch).toBe("develop")
    expect(updated.internal_port).toBe(8080)
    expect(updated.health_check_path).toBe("/health")
    expect(updated.pre_deploy_command).toBe("npm run test")
    expect(updated.post_deploy_command).toBe("npm run notify")
    expect(updated.auto_deploy).toBe(true)

    // Verify persisted in client
    const fetched = await api.services.get("srv_web_prod")
    expect(fetched.name).toBe("acme-web-v2")
    expect(fetched.internal_port).toBe(8080)
    expect(fetched.auto_deploy).toBe(true)
  })

  it("allows switching service type to worker without port", async () => {
    resetApiClient()

    const updated = await api.services.update("srv_web_prod", {
      service_type: "worker",
      internal_port: 0,
      health_check_path: "",
      command: "python worker.py",
    })

    expect(updated.service_type).toBe("worker")
    expect(updated.internal_port).toBe(0)
    expect(updated.health_check_path).toBe("")
    expect(updated.command).toBe("python worker.py")

    const fetched = await api.services.get("srv_web_prod")
    expect(fetched.service_type).toBe("worker")
    expect(fetched.command).toBe("python worker.py")
  })

  it("updates push and tag triggers via MockApiClient", async () => {
    resetApiClient()

    const updated = await api.services.update("srv_web_prod", {
      trigger_on_push: false,
      trigger_on_tag: true,
      tag_pattern: "v*",
    })

    expect(updated.trigger_on_push).toBe(false)
    expect(updated.auto_deploy).toBe(false)
    expect(updated.trigger_on_tag).toBe(true)
    expect(updated.tag_pattern).toBe("v*")

    const fetched = await api.services.get("srv_web_prod")
    expect(fetched.trigger_on_push).toBe(false)
    expect(fetched.auto_deploy).toBe(false)
    expect(fetched.trigger_on_tag).toBe(true)
    expect(fetched.tag_pattern).toBe("v*")
  })

  it("renders database service settings cleanly", () => {
    const html = renderToString(
      <ServiceProvider serviceId="srv_acme_postgres" projectId="prj_acme">
        <ServiceSettingsPage />
      </ServiceProvider>
    )

    expect(html).toBeDefined()
    expect(html).not.toContain("—")
  })
})
