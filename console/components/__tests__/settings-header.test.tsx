import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { SettingsHeader, SETTINGS_TABS } from "../settings-header"

let mockCurrentPath = "/settings"

mock.module("next/navigation", () => ({
  usePathname: () => mockCurrentPath,
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("SettingsHeader", () => {
  it("renders title, description, and all settings tabs", () => {
    mockCurrentPath = "/settings"
    const html = renderToString(
      <SettingsHeader
        title="Settings"
        description="Configure administrator profile, security, and platform preferences."
      />
    )

    expect(html).toContain("Settings")
    expect(html).toContain(
      "Configure administrator profile, security, and platform preferences."
    )
    expect(html).not.toContain("—")
    expect(html).not.toContain("shadow-")

    for (const tab of SETTINGS_TABS) {
      expect(html).toContain(tab.label.replace("&", "&amp;"))
      expect(html).toContain(tab.href)
    }
  })

  it("marks the active tab with border-foreground and aria-current", () => {
    mockCurrentPath = "/settings/storage"
    const html = renderToString(
      <SettingsHeader
        title="Storage Destinations"
        description="Centralized management for multiple S3-compatible endpoints."
      />
    )

    expect(html).toContain('aria-current="page"')
    expect(html).toContain("Storage")
  })

  it("renders action button when provided", () => {
    mockCurrentPath = "/settings/notifications"
    const html = renderToString(
      <SettingsHeader
        title="Notification Settings"
        description="Configure administrator profile, security, and notification alerts."
        action={<button type="button">Add Channel</button>}
      />
    )

    expect(html).toContain("Add Channel")
    expect(html).toContain("[&amp;_button]:h-9")
  })

  it("does not render action slot when action is undefined", () => {
    mockCurrentPath = "/settings"
    const html = renderToString(
      <SettingsHeader
        title="Settings"
        description="Configure administrator profile."
      />
    )

    expect(html).not.toContain("Add Channel")
  })
})
