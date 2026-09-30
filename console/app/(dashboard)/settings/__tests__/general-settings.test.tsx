import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import SettingsPage, {
  AdminProfileCard,
  ChangePasswordCard,
  AuthShortcutCard,
  CleanupPolicyCard,
} from "../page"
import { api, type AdminUser } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/settings",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("General Settings Page & M5-005 Cards", () => {
  const mockAdminUser: AdminUser = {
    id: "admin-1",
    email: "admin@gettako.dev",
    name: "Admin Owner",
    role: "admin",
    two_factor_enabled: true,
    passkeys_enabled: true,
    created_at: "2026-01-01T00:00:00Z",
  }

  it("renders SettingsPage layout cleanly with zero em dashes", () => {
    const html = renderToString(<SettingsPage />)
    expect(html).toContain("Settings")
    expect(html).toContain("General")
    expect(html).toContain("Users")
    expect(html).toContain("GitHub Integration")
    expect(html).not.toContain("—")
  })

  it("renders AdminProfileCard and interacts with api.auth.updateProfile", async () => {
    const html = renderToString(<AdminProfileCard user={mockAdminUser} />)
    expect(html).toContain("Administrator Profile")
    expect(html).toContain("Full Name")
    expect(html).toContain("Email Address")
    expect(html).toContain("Save Profile")
    expect(html).not.toContain("—")

    // Verify API client updateProfile works
    const updated = await api.auth.updateProfile({ email: "ops@gettako.dev" })
    expect(updated.email).toBe("ops@gettako.dev")

    // Restore original mock email
    await api.auth.updateProfile({ email: "admin@gettako.dev" })
  })

  it("renders ChangePasswordCard and interacts with api.auth.changePassword", async () => {
    const html = renderToString(<ChangePasswordCard />)
    expect(html).toContain("Change Password")
    expect(html).toContain("Current Password")
    expect(html).toContain("New Password")
    expect(html).toContain("Confirm New Password")
    expect(html).toContain("Update Password")
    expect(html).not.toContain("—")

    // Verify API client changePassword succeeds
    const result = await api.auth.changePassword({
      current_password: "oldPassword123!",
      new_password: "newPassword456!",
    })
    expect(result.success).toBe(true)
  })

  it("renders AuthShortcutCard with 2FA and Passkey indicators and link", () => {
    const html = renderToString(<AuthShortcutCard user={mockAdminUser} />)
    expect(html).toContain("Security &amp; Two-Factor Authentication")
    expect(html).toContain("Two-Factor Authentication:")
    expect(html).toContain("Enabled")
    expect(html).toContain("Passkeys / WebAuthn:")
    expect(html).toContain("Configured")
    expect(html).toContain("Manage 2FA &amp; Passkeys")
    expect(html).toContain("/settings/security")
    expect(html).not.toContain("—")
  })

  it("renders CleanupPolicyCard with image count and retention days", () => {
    const html = renderToString(<CleanupPolicyCard />)
    expect(html).toContain("Automated Cleanup Policy")
    expect(html).toContain("Rollback Images Preserved Per Service")
    expect(html).toContain("Build Cache Retention (Days)")
    expect(html).toContain("Save Retention Policy")
    expect(html).not.toContain("—")
  })
})
