import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import SettingsUsersPage from "../page"
import { api, type User, type Invite } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/settings/users",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("SettingsUsersPage", () => {
  it("renders page header and invite action with zero em dashes and zero shadows", () => {
    const html = renderToString(<SettingsUsersPage />)

    expect(html).toContain("Users")
    expect(html).toContain(
      "Manage cluster users, assign roles (Admin / Member), and invite collaborators."
    )
    expect(html).toContain("Invite User")
    expect(html).not.toContain("—")
    expect(html).not.toContain("shadow-")
  })

  it("interacts with api.users mock methods", async () => {
    // 1. List users
    const users = await api.users.list()
    expect(Array.isArray(users)).toBe(true)
    expect(users.length).toBeGreaterThan(0)

    const admin = users.find((u) => u.role === "admin")
    expect(admin).toBeDefined()
    expect(admin?.role).toBe("admin")

    // 2. Cannot demote the last admin
    if (users.filter((u) => u.role === "admin").length === 1 && admin) {
      await expect(
        api.users.updateRole(admin.id, { role: "member" })
      ).rejects.toThrow()
    }

    // 3. Update non-admin role
    const member = users.find((u) => u.role === "member")
    if (member) {
      const updated = await api.users.updateRole(member.id, { role: "admin" })
      expect(updated.role).toBe("admin")

      // Revert back
      const reverted = await api.users.updateRole(member.id, { role: "member" })
      expect(reverted.role).toBe("member")
    }

    // 4. Delete user
    const deleteInvite = await api.invites.create({ role: "member" })
    const newUser = await api.invites.accept({
      token: deleteInvite.token,
      name: "Temporary User",
      email: "temp@example.com",
      password: "password123!",
    })
    expect(newUser).toBeDefined()

    const usersAfterAdd = await api.users.list()
    const tempUser = usersAfterAdd.find((u) => u.email === "temp@example.com")
    expect(tempUser).toBeDefined()

    if (tempUser) {
      const delRes = await api.users.delete(tempUser.id)
      expect(delRes.success).toBe(true)

      const usersAfterDel = await api.users.list()
      expect(usersAfterDel.some((u) => u.id === tempUser.id)).toBe(false)
    }
  })

  it("interacts with api.invites mock methods", async () => {
    // 1. Create invite
    const inviteRes = await api.invites.create({ role: "member" })
    expect(inviteRes.token).toBeDefined()
    expect(inviteRes.role).toBe("member")

    // 2. List invites
    const invites = await api.invites.list()
    expect(invites.some((i) => i.id === inviteRes.id)).toBe(true)

    // 3. Validate invite
    const valRes = await api.invites.validate(inviteRes.token)
    expect(valRes.valid).toBe(true)
    expect(valRes.role).toBe("member")

    // 4. Revoke invite
    const revokeRes = await api.invites.revoke(inviteRes.id)
    expect(revokeRes.success).toBe(true)

    // 5. Validating revoked invite fails
    const valAfterRevoke = await api.invites.validate(inviteRes.token)
    expect(valAfterRevoke.valid).toBe(false)
  })
})
