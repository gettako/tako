import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import RegisterPage from "../page"
import { api } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "token" ? "inv_valid_mock_token" : null),
  }),
  usePathname: () => "/register",
}))

describe("RegisterPage", () => {
  it("renders page header and card with zero em dashes and zero shadows", () => {
    const html = renderToString(<RegisterPage />)

    expect(html).toContain("Tako")
    expect(html).toContain("Control Plane")
    expect(html).toContain("Join the Workspace")
    expect(html).not.toContain("—")
    expect(html).not.toContain("shadow-")
  })

  it("handles valid invite token registration flow", async () => {
    // 1. Create a fresh invite
    const invite = await api.invites.create({ role: "member" })
    expect(invite.token).toBeTruthy()

    // 2. Validate token
    const val = await api.invites.validate(invite.token)
    expect(val.valid).toBe(true)
    expect(val.role).toBe("member")

    // 3. Register user with token
    const acceptRes = await api.invites.accept({
      token: invite.token,
      name: "New Collaborator",
      email: "collab@example.com",
      password: "securePassword123!",
    })

    expect(acceptRes.session_id).toBeTruthy()
    expect(acceptRes.requires_2fa).toBe(false)

    // 4. Token cannot be reused
    const valReused = await api.invites.validate(invite.token)
    expect(valReused.valid).toBe(false)
  })

  it("rejects registration with invalid token", async () => {
    await expect(
      api.invites.accept({
        token: "non_existent_token_12345",
        name: "Hacker",
        email: "hacker@example.com",
        password: "password123!",
      })
    ).rejects.toThrow()
  })
})
