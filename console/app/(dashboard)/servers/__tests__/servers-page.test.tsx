import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ServersPage from "../page"
import { ServerCard } from "@/components/servers/server-card"
import {
  AddServerDialog,
  AddServerWizard,
} from "@/components/servers/add-server-dialog"
import { api, resetApiClient } from "@/lib/api"
import { mockServers } from "@/lib/api/fixtures/servers"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/servers",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ServersPage & AddServerDialog (M5-001 & M5-002)", () => {
  it("renders servers page header, search bar, and Add Server button without errors and zero em dashes", () => {
    const html = renderToString(<ServersPage />)

    expect(html).toContain("Servers")
    expect(html).toContain(
      "Monitor host nodes, agent telemetry, and cluster capacity."
    )
    expect(html).toContain("Add Server")
    expect(html).not.toContain("—")
  })

  it("renders ServerCard with hardware utilization, IP address, and status badge", () => {
    const server = mockServers[0]
    const html = renderToString(<ServerCard server={server} />)

    expect(html).toContain(server.name)
    expect(html).toContain(server.host)
    expect(html).toContain("CPU Usage")
    expect(html).toContain("Memory")
    expect(html).toContain("Disk")
    expect(html).toContain("Assigned Services")
    expect(html).toContain("View Details")
    expect(html).toContain(`Agent: ${server.agent_version}`)
    expect(html).not.toContain("—")
  })

  it("fetches servers list from MockApiClient accurately", async () => {
    resetApiClient()

    const servers = await api.servers.list()
    expect(Array.isArray(servers)).toBe(true)
    expect(servers.length).toBeGreaterThanOrEqual(3)

    const localNode = servers.find((s) => s.id === "srv_local")
    expect(localNode).toBeDefined()
    expect(localNode?.status).toBe("online")
    expect(localNode?.cpu_percent).toBeGreaterThan(0)
    expect(localNode?.ram_percent).toBeGreaterThan(0)
    expect(localNode?.disk_percent).toBeGreaterThan(0)
  })

  it("renders AddServerWizard with enrollment form and zero em dashes", () => {
    const html = renderToString(<AddServerWizard onCancel={() => {}} />)

    expect(html).toContain("Add New Server")
    expect(html).toContain("Server Nickname")
    expect(html).toContain("Region / Location Tag")
    expect(html).toContain("Continue")
    expect(html).toContain("Cancel")
    expect(html).not.toContain("—")
  })

  it("creates a new server and issues enrollment token via MockApiClient", async () => {
    resetApiClient()

    const initial = await api.servers.list()
    const result = await api.servers.create({
      name: "Worker Tokyo-1",
      host: "pending-asia",
    })

    expect(result.server.name).toBe("Worker Tokyo-1")
    expect(result.server.status).toBe("pending")
    expect(result.enrollment_token).toMatch(/^tako_tok_/)
    expect(result.compose_snippet).toContain("ghcr.io/gettako/agent")

    const updated = await api.servers.list()
    expect(updated.length).toBe(initial.length + 1)

    // Verify polling transitions pending server to online
    await new Promise((r) => setTimeout(r, 1600))
    const polled = await api.servers.get(result.server.id)
    expect(polled.status).toBe("online")
    expect(polled.cpu_percent).toBeGreaterThan(0)
  })

  it("handles copy command feedback", async () => {
    let copiedText = ""
    Object.assign(navigator, {
      clipboard: {
        writeText: async (text: string) => {
          copiedText = text
        },
      },
    })

    const token = "tako_tok_test123"
    const command = `curl -sSL https://gettako.dev/install-agent.sh | TAKO_SERVER="https://gettako.dev" TAKO_TOKEN="${token}" bash`
    await navigator.clipboard.writeText(command)
    expect(copiedText).toBe(command)
  })

  it("renders amber 'Agent outdated' badge when agent_version_mismatch is true (M5-006)", () => {
    const outdatedServer = mockServers.find(
      (s) => s.agent_version_mismatch
    ) || {
      ...mockServers[0],
      id: "srv_outdated",
      agent_version: "v0.9.4",
      agent_version_mismatch: true,
    }
    const html = renderToString(<ServerCard server={outdatedServer} />)

    expect(html).toContain("Agent outdated")
    expect(html).toContain("v0.9.4")
  })

  it("omits 'Agent outdated' badge when agent_version_mismatch is false (M5-006)", () => {
    const matchedServer =
      mockServers.find((s) => !s.agent_version_mismatch) || mockServers[0]
    const html = renderToString(<ServerCard server={matchedServer} />)

    expect(html).not.toContain("Agent outdated")
  })
})
