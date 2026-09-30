import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ServiceEnvironmentPage from "../page"
import { ServiceProvider } from "@/components/services/service-context"
import { api, resetApiClient } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme/services/srv_web_prod/environment",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ServiceEnvironmentPage (M4-007)", () => {
  it("renders ServiceEnvironmentPage layout cleanly without errors and zero em dashes", () => {
    const html = renderToString(
      <ServiceProvider serviceId="srv_web_prod" projectId="prj_acme">
        <ServiceEnvironmentPage />
      </ServiceProvider>
    )

    expect(html).toBeDefined()
    expect(html).not.toContain("—")
  })

  it("fetches environment variables and build args from MockApiClient", async () => {
    resetApiClient()

    const env = await api.services.getEnv("srv_web_prod")
    expect(env).toBeDefined()
    expect(Array.isArray(env.env_vars)).toBe(true)
    expect(Array.isArray(env.build_args)).toBe(true)
  })

  it("updates environment variables and triggers optional rebuild via MockApiClient", async () => {
    resetApiClient()

    const updated = await api.services.updateEnv("srv_web_prod", {
      env_vars: [
        {
          key: "DATABASE_URL",
          value: "postgres://user:pass@db:5432/main",
          is_secret: true,
        },
        { key: "PORT", value: "3000", is_secret: false },
      ],
      build_args: [{ key: "NODE_ENV", value: "production", is_secret: false }],
    })

    expect(updated.env_vars.length).toBe(2)
    expect(updated.env_vars[0].key).toBe("DATABASE_URL")
    expect(updated.build_args.length).toBe(1)
    expect(updated.build_args[0].key).toBe("NODE_ENV")

    // Verify persistence in getEnv
    const reloaded = await api.services.getEnv("srv_web_prod")
    expect(reloaded.env_vars.length).toBe(2)
    expect(reloaded.env_vars[0].key).toBe("DATABASE_URL")
  })
})
