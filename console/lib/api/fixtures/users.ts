import type { User, Invite } from "../client"

export const mockUsers: User[] = [
  {
    id: "usr_admin",
    email: "admin@gettako.dev",
    name: "Admin Owner",
    role: "admin",
    two_factor_enabled: false,
    passkeys_enabled: false,
    created_at: "2026-09-01T08:00:00Z",
  },
  {
    id: "usr_member_1",
    email: "sarah@gettako.dev",
    name: "Sarah Chen",
    role: "member",
    two_factor_enabled: true,
    passkeys_enabled: true,
    created_at: "2026-09-15T14:30:00Z",
  },
  {
    id: "usr_member_2",
    email: "marcus@gettako.dev",
    name: "Marcus Vance",
    role: "member",
    two_factor_enabled: false,
    passkeys_enabled: false,
    created_at: "2026-09-20T09:15:00Z",
  },
]

export const mockInvites: (Invite & { token: string })[] = [
  {
    id: "inv_dev_pending",
    role: "member",
    created_by: "usr_admin",
    expires_at: new Date(Date.now() + 86400000 * 5).toISOString(),
    used_at: null,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    token: "tako_inv_mock_token_12345",
  },
]
