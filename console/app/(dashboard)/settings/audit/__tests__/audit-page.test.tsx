import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import AuditSettingsPage from "../page"
import { api, mockAuditLogs } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/settings/audit",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("AuditSettingsPage", () => {
  it("renders page header, tabs, and skeleton on initial render with zero em dashes", () => {
    const html = renderToString(<AuditSettingsPage />)
    expect(html).toContain("Audit Log")
    expect(html).toContain("General")
    expect(html).toContain("Users")
    expect(html).toContain("GitHub Integration")
    expect(html).toContain("Storage")
    expect(html).toContain("Backups")
    expect(html).toContain("Notifications")
    expect(html).toContain("border-foreground") // active tab
    expect(html).not.toContain("—")
  })

  it("fetches mock audit logs via api.auditLog.list", async () => {
    const res = await api.auditLog.list({ limit: 50 })
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.items[0].action).toBe("service.deploy")
    expect(res.items[0].resource_type).toBe("service")

    // Verify all mock entries contain no em dashes
    for (const item of res.items) {
      expect(item.action).not.toContain("—")
      if (item.metadata) {
        expect(JSON.stringify(item.metadata)).not.toContain("—")
      }
    }
  })

  it("handles cursor-based pagination via MockApiClient", async () => {
    const page1 = await api.auditLog.list({ limit: 2 })
    expect(page1.items.length).toBe(2)
    expect(page1.next_cursor).toBeDefined()
    expect(page1.next_cursor).not.toBeNull()

    const page2 = await api.auditLog.list({
      limit: 2,
      before: page1.next_cursor!,
    })
    expect(page2.items.length).toBe(2)
    expect(page2.items[0].id).not.toBe(page1.items[0].id)
  })

  it("verifies mock fixture includes all required action types", () => {
    const actions = new Set(mockAuditLogs.map((e) => e.action))
    expect(actions.has("service.deploy")).toBe(true)
    expect(actions.has("env.update")).toBe(true)
    expect(actions.has("domain.add")).toBe(true)
    expect(actions.has("server.prune")).toBe(true)
    expect(actions.has("service.rollback")).toBe(true)
    expect(actions.has("session.login")).toBe(true)
    expect(actions.has("project.create")).toBe(true)
    expect(actions.has("server.add")).toBe(true)
  })
})
