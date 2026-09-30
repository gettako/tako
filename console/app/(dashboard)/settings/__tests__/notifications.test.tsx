import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import SettingsNotificationsPage from "../notifications/page"
import { NotificationsShortcutCard } from "../page"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/settings/notifications",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("Settings Notifications Page", () => {
  it("renders SettingsNotificationsPage layout with zero em dashes", () => {
    const html = renderToString(<SettingsNotificationsPage />)
    expect(html).toContain("Settings")
    expect(html).toContain("Notifications")
    expect(html).toContain("Add Channel")
    expect(html).not.toContain("—")
  })

  it("renders NotificationsShortcutCard with Discord and Telegram mentions", () => {
    const html = renderToString(<NotificationsShortcutCard />)
    expect(html).toContain("Notifications &amp; Alerts")
    expect(html).toContain("Discord, Telegram")
    expect(html).toContain("/settings/notifications")
    expect(html).not.toContain("—")
  })
})
