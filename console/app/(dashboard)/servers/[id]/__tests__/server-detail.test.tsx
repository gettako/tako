import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ServerDetailPage, {
  PruneDialogContent,
  UnregisterDialogContent,
} from "../page"
import { api, resetApiClient } from "@/lib/api"
import { mockServerDetails } from "@/lib/api/fixtures/servers"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/servers/srv_local",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ServerDetailPage (M5-003)", () => {
  it("renders ServerDetailPage layout without errors and with zero em dashes", () => {
    const html = renderToString(
      <ServerDetailPage params={{ id: "srv_local" }} />
    )

    expect(html).not.toContain("—")
    expect(html).toBeDefined()
  })

  it("renders PruneDialogContent with explanation and zero em dashes", () => {
    const html = renderToString(
      <PruneDialogContent
        serverName="Primary Control Node"
        onConfirm={async () => {}}
        onCancel={() => {}}
        isPruning={false}
      />
    )

    expect(html).toContain("Prune Docker Resources")
    expect(html).toContain("Reclaim disk space on node Primary Control Node")
    expect(html).toContain(
      "The last 5 successful deployment images per active service are always preserved."
    )
    expect(html).toContain("Confirm &amp; Prune")
    expect(html).not.toContain("—")
  })

  it("renders UnregisterDialogContent without em dashes", () => {
    const html = renderToString(
      <UnregisterDialogContent
        serverName="Worker EU-Central"
        onConfirm={async () => {}}
        onCancel={() => {}}
        isDeleting={false}
      />
    )

    expect(html).toContain("Unregister Server")
    expect(html).toContain("Disconnect Worker EU-Central")
    expect(html).toContain("Unregister Server")
    expect(html).not.toContain("—")
  })

  it("fetches server detail specifications and child services from MockApiClient", async () => {
    resetApiClient()

    const detail = await api.servers.get("srv_local")
    expect(detail).toBeDefined()
    expect(detail.name).toBe("Primary Control Node (Local)")
    expect(detail.docker_version).toBe("26.1.4")
    expect(detail.os_info).toContain("Ubuntu")
    expect(detail.uptime_seconds).toBeGreaterThan(0)
    expect(Array.isArray(detail.services)).toBe(true)
    expect(detail.services.length).toBe(4)

    const firstService = detail.services[0]
    expect(firstService.name).toBe("acme-web")
    expect(firstService.internal_port).toBe(3000)
    expect(firstService.status).toBe("running")
  })

  it("executes Docker prune and returns reclaimed disk space", async () => {
    resetApiClient()

    const result = await api.servers.prune("srv_local")
    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.reclaimed_bytes).toBeGreaterThan(0)
    expect(result.message).toContain("Cleaned")
    expect(result.message).not.toContain("—")
  })

  it("rejects unregistering a server with active services", async () => {
    resetApiClient()

    // srv_local has 4 active services
    expect(async () => {
      await api.servers.delete("srv_local")
    }).toThrow()
  })

  it("allows unregistering a server with zero services", async () => {
    resetApiClient()

    // Create a new server (has 0 services)
    const res = await api.servers.create({
      name: "Temporary Worker Node",
      host: "192.0.2.99",
    })

    const initialServers = await api.servers.list()
    expect(initialServers.some((s) => s.id === res.server.id)).toBe(true)

    // Delete should succeed
    await api.servers.delete(res.server.id)

    const afterServers = await api.servers.list()
    expect(afterServers.some((s) => s.id === res.server.id)).toBe(false)
  })

  it("validates YAML client side for forbidden tab indentation and unclosed quotes", async () => {
    const { validateYamlClientSide } =
      await import("@/components/editor/yaml-code-editor")

    const validYaml = `http:
  middlewares:
    sample:
      headers:
        sslRedirect: true
`
    expect(validateYamlClientSide(validYaml)).toEqual([])

    const yamlWithTabs = `http:
\tmiddlewares:
\t\tsample: true
`
    const tabErrors = validateYamlClientSide(yamlWithTabs)
    expect(tabErrors.length).toBeGreaterThan(0)
    expect(tabErrors[0].message).toContain("tab indentation")

    const yamlWithUnclosedQuote = `http:
  routers:
    broken:
      rule: "Host('example.com')
`
    const quoteErrors = validateYamlClientSide(yamlWithUnclosedQuote)
    expect(quoteErrors.length).toBeGreaterThan(0)
    expect(quoteErrors[0].message).toContain("unclosed double quote")
  })

  it("renders TraefikRestartDialogContent without em dashes", async () => {
    const { TraefikRestartDialogContent } =
      await import("@/components/servers/traefik-proxy-tab")

    const html = renderToString(
      <TraefikRestartDialogContent
        serverName="Primary Control Node"
        onConfirm={async () => {}}
        onCancel={() => {}}
        isRestarting={false}
      />
    )

    expect(html).toContain("Restart Traefik Proxy")
    expect(html).toContain(
      "Restart reverse proxy container on Primary Control Node"
    )
    expect(html).toContain("Confirm &amp; Restart")
    expect(html).not.toContain("—")
  })

  it("fetches, updates, and restarts Traefik proxy via MockApiClient", async () => {
    resetApiClient()

    // 1. Fetch config
    const config = await api.servers.getTraefikConfig("srv_local")
    expect(config).toBeDefined()
    expect(config.custom_yaml).toContain("http:")
    expect(config.static_yaml).toContain("entryPoints:")
    expect(config.static_yaml).toContain("letsencrypt:")

    // 2. Update custom dynamic config
    const newYaml = `http:
  middlewares:
    cors-allow-all:
      headers:
        accessControlAllowOriginList:
          - "*"
`
    const updated = await api.servers.updateTraefikConfig("srv_local", {
      custom_yaml: newYaml,
    })
    expect(updated.custom_yaml).toBe(newYaml)

    // Verify it persists in subsequent get
    const refetched = await api.servers.getTraefikConfig("srv_local")
    expect(refetched.custom_yaml).toBe(newYaml)

    // 3. Restart Traefik proxy
    const restartResult = await api.servers.restartTraefik("srv_local")
    expect(restartResult.success).toBe(true)
  })

  it("renders Agent Version Mismatch banner when versions differ (M5-006)", () => {
    const html = renderToString(
      <ServerDetailPage
        params={{ id: "srv_worker_us" }}
        initialServer={mockServerDetails["srv_worker_us"]}
      />
    )

    expect(html).toContain("Agent Version Mismatch")
    expect(html).toContain("This agent is running v0.9.4")
    expect(html).toContain("The control plane expects v1.0.0")
    expect(html).toContain(
      "docker compose pull &amp;&amp; docker compose up -d"
    )
    expect(html).toContain("Copy Command")
    expect(html).not.toContain("—")
  })

  it("omits Agent Version Mismatch banner when versions match (M5-006)", () => {
    const html = renderToString(
      <ServerDetailPage
        params={{ id: "srv_local" }}
        initialServer={mockServerDetails["srv_local"]}
      />
    )

    expect(html).not.toContain("Agent Version Mismatch")
    expect(html).not.toContain("Copy Command")
  })

  it("renders Build Settings card with stepper and concurrency controls (M5-006)", () => {
    const html = renderToString(
      <ServerDetailPage
        params={{ id: "srv_local" }}
        initialServer={mockServerDetails["srv_local"]}
      />
    )

    expect(html).toContain("Build Settings")
    expect(html).toContain("Max concurrent builds")
    expect(html).toContain(
      "Additional deploy jobs beyond this limit are queued and execute in order."
    )
    expect(html).toContain("Save")
    expect(html).not.toContain("—")
  })

  it("updates server max_concurrent_builds via api.servers.update and persists (M5-006)", async () => {
    resetApiClient()

    const initial = await api.servers.get("srv_local")
    expect(initial.max_concurrent_builds).toBe(2)

    const updated = await api.servers.update("srv_local", {
      max_concurrent_builds: 6,
    })
    expect(updated.max_concurrent_builds).toBe(6)

    const refetched = await api.servers.get("srv_local")
    expect(refetched.max_concurrent_builds).toBe(6)
  })

  it("rejects concurrency limits outside 1-8 via api.servers.update (M5-006)", async () => {
    resetApiClient()

    // Test 0 (below min 1)
    expect(async () => {
      await api.servers.update("srv_local", {
        max_concurrent_builds: 0,
      })
    }).toThrow()

    // Test 9 (above max 8)
    expect(async () => {
      await api.servers.update("srv_local", {
        max_concurrent_builds: 9,
      })
    }).toThrow()
  })

  it("updates server name and host IP via api.servers.update and persists", async () => {
    resetApiClient()

    const initial = await api.servers.get("srv_local")
    expect(initial.name).toBe("Primary Control Node (Local)")

    const updated = await api.servers.update("srv_local", {
      name: "Primary Production Node",
      host: "203.0.113.50",
    })
    expect(updated.name).toBe("Primary Production Node")
    expect(updated.host).toBe("203.0.113.50")

    const refetched = await api.servers.get("srv_local")
    expect(refetched.name).toBe("Primary Production Node")
    expect(refetched.host).toBe("203.0.113.50")

    // Check that server list also reflects updated values
    const list = await api.servers.list()
    const found = list.find((s) => s.id === "srv_local")
    expect(found?.name).toBe("Primary Production Node")
    expect(found?.host).toBe("203.0.113.50")
  })

  it("renders Edit Server action button without em dashes", () => {
    const html = renderToString(
      <ServerDetailPage
        params={{ id: "srv_local" }}
        initialServer={mockServerDetails["srv_local"]}
      />
    )

    expect(html).toContain("Edit Server")
    expect(html).not.toContain("—")
  })
})
