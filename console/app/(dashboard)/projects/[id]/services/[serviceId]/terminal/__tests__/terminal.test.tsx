import { describe, it, expect, mock, beforeEach } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ServiceTerminalPage from "../page"
import { ServiceProvider } from "@/components/services/service-context"
import { api, resetApiClient } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme/services/srv_api_prod/terminal",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ServiceTerminalPage & Remote Exec Hooks (M14-004)", () => {
  beforeEach(() => {
    resetApiClient()
  })

  it("renders ServiceTerminalPage without crashing and contains zero em dashes", () => {
    const html = renderToString(
      <ServiceProvider serviceId="srv_api_prod" projectId="prj_acme">
        <ServiceTerminalPage />
      </ServiceProvider>
    )

    // Initial state or skeleton render check
    expect(html).toBeDefined()
    // Antislop check: Zero em dashes in rendered markup
    expect(html).not.toContain("—")
    expect(html).not.toContain("&mdash;")
    // Antislop check: Zero drop shadows in rendered markup
    expect(html).not.toContain("shadow-")
  })

  it("generates correct terminal WebSocket URL via getTerminalWebSocketUrl", () => {
    const wsUrlSh = api.services.getTerminalWebSocketUrl(
      "srv_web_prod",
      "/bin/sh"
    )
    expect(wsUrlSh).toContain(
      "/api/services/srv_web_prod/terminal?shell=%2Fbin%2Fsh"
    )

    const wsUrlBash = api.services.getTerminalWebSocketUrl(
      "srv_web_prod",
      "/bin/bash"
    )
    expect(wsUrlBash).toContain(
      "/api/services/srv_web_prod/terminal?shell=%2Fbin%2Fbash"
    )

    const wsUrlWithContainer = api.services.getTerminalWebSocketUrl(
      "srv_compose_prod",
      "/bin/sh",
      "redis"
    )
    expect(wsUrlWithContainer).toContain("shell=%2Fbin%2Fsh")
    expect(wsUrlWithContainer).toContain("container=redis")
  })

  it("creates service with pre_deploy_command and post_deploy_command", async () => {
    const created = await api.services.create({
      project_id: "prj_acme",
      name: "acme-migrated-api",
      dockerfile_path: "Dockerfile",
      internal_port: 3000,
      health_check_path: "/healthz",
      pre_deploy_command: "php artisan down",
      post_deploy_command: "php artisan migrate --force",
    })

    expect(created.id).toBeDefined()
    expect(created.name).toBe("acme-migrated-api")
    expect(created.pre_deploy_command).toBe("php artisan down")
    expect(created.post_deploy_command).toBe("php artisan migrate --force")

    const fetched = await api.services.get(created.id)
    expect(fetched.pre_deploy_command).toBe("php artisan down")
    expect(fetched.post_deploy_command).toBe("php artisan migrate --force")
  })

  it("updates pre_deploy_command and post_deploy_command on existing service", async () => {
    const updated = await api.services.update("srv_api_prod", {
      pre_deploy_command: "npm run prebuild",
      post_deploy_command: "npm run db:migrate",
    })

    expect(updated.pre_deploy_command).toBe("npm run prebuild")
    expect(updated.post_deploy_command).toBe("npm run db:migrate")

    const fetched = await api.services.get("srv_api_prod")
    expect(fetched.pre_deploy_command).toBe("npm run prebuild")
    expect(fetched.post_deploy_command).toBe("npm run db:migrate")
  })
})
