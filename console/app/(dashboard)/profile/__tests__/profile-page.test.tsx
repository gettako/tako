import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ProfilePage from "../page"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/profile",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ProfilePage (Dedicated Account & Profile)", () => {
  it("renders Account & Profile layout with Personal Details, Password, TOTP, and Passkeys sections", () => {
    const html = renderToString(<ProfilePage />)

    expect(html).toContain("Account &amp; Profile")
    expect(html).toContain("Personal Details")
    expect(html).toContain("Change Password")
    expect(html).toContain("Two-Factor Authentication (TOTP)")
    expect(html).toContain("Passkeys &amp; Security Keys")
    expect(html).not.toContain("—")
    expect(html).not.toContain("shadow-")
  })
})
