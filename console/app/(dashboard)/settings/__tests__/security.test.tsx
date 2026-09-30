import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import SecuritySettingsPage from "../security/page"
import SettingsPage from "../page"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/settings/security",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("Settings Pages", () => {
  it("renders Settings overview page with tabs and links", () => {
    const html = renderToString(<SettingsPage />)
    expect(html).toContain("Settings")
    expect(html).toContain("Users")
    expect(html).toContain("Automated Cleanup Policy")
    expect(html).not.toContain("—")
  })

  it("renders Security & Authentication page with TOTP and Passkeys sections", () => {
    const html = renderToString(<SecuritySettingsPage />)

    expect(html).toContain("Security &amp; Authentication")
    expect(html).toContain("Two-Factor Authentication (TOTP)")
    expect(html).toContain("Passkeys &amp; Security Keys")
    expect(html).toContain("Register New Passkey")
    expect(html).not.toContain("—")
  })
})
