import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  setAuthToken,
  type ApiCurrentUser,
  type ApiPasskey,
  type ApiSession,
} from "@/lib/api"
import { persistSetting } from "@/services/settings.service"
import { USER_ROLE, type CurrentUserProfile, type UserPasskey, type UserRole, type UserSession } from "@/types/platform"

export const DEFAULT_USER: CurrentUserProfile = {
  id: "",
  name: "",
  handle: "",
  email: "",
  role: "member",
  title: "",
  bio: "",
  timezone: "UTC",
  defaultLanding: "dashboard",
  twoFactorEnabled: false,
  createdAt: "",
  lastLoginAt: "",
}

export function mapCurrentUser(
  user: ApiCurrentUser,
  extra: Partial<CurrentUserProfile> = {}
): CurrentUserProfile {
  const cleanExtra = Object.fromEntries(
    Object.entries(extra).filter(
      ([, value]) => value !== undefined && value !== ""
    )
  ) as Partial<CurrentUserProfile>

  return {
    ...DEFAULT_USER,
    ...cleanExtra,
    id: user.id,
    name: user.name,
    handle: cleanExtra.handle || user.email.split("@")[0] || "",
    email: user.email,
    role:
      user.role === USER_ROLE.OWNER ||
      user.role === USER_ROLE.ADMIN ||
      user.role === USER_ROLE.MEMBER
        ? user.role
        : USER_ROLE.MEMBER,
    avatarUrl: user.avatarUrl,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt || "",
    lastLoginAt: user.createdAt || "",
  }
}

export async function loadProfileExtra(): Promise<Record<string, unknown>> {
  try {
    const raw = await apiGet<Record<string, unknown>>("/settings")
    const extra =
      raw?.user_profile_extra && typeof raw.user_profile_extra === "object"
        ? (raw.user_profile_extra as Record<string, unknown>)
        : {}
    return extra
  } catch {
    return {}
  }
}

export async function getCurrentUser(): Promise<CurrentUserProfile> {
  const data = await apiGet<{ authenticated: boolean; user: ApiCurrentUser }>("/auth/me")
  const extra = await loadProfileExtra()
  return mapCurrentUser(data.user, {
    handle: (extra.handle as string) || undefined,
    title: (extra.title as string) || undefined,
    bio: (extra.bio as string) || undefined,
    timezone: (extra.timezone as string) || undefined,
    defaultLanding: (extra.defaultLanding as CurrentUserProfile["defaultLanding"]) || undefined,
    gpgKeyId: (extra.gpgKeyId as string) || undefined,
  })
}

export async function updateCurrentUser(
  updates: Partial<CurrentUserProfile>,
  current?: CurrentUserProfile
): Promise<void> {
  if (
    updates.name !== undefined ||
    updates.email !== undefined ||
    updates.avatarUrl !== undefined
  ) {
    await apiPut("/auth/profile", {
      name: updates.name ?? current?.name ?? "",
      email: updates.email ?? current?.email ?? "",
      avatarUrl: updates.avatarUrl ?? current?.avatarUrl ?? "",
    })
  }

  if (updates.twoFactorEnabled !== undefined) {
    await apiPut("/auth/2fa", { enabled: updates.twoFactorEnabled })
  }

  const extra = {
    handle: updates.handle ?? current?.handle,
    title: updates.title ?? current?.title,
    bio: updates.bio ?? current?.bio,
    timezone: updates.timezone ?? current?.timezone,
    defaultLanding: updates.defaultLanding ?? current?.defaultLanding,
    gpgKeyId: updates.gpgKeyId ?? current?.gpgKeyId,
  }
  await persistSetting("user_profile_extra", extra)
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiPut("/auth/password", { currentPassword, newPassword })
}

export async function updateTwoFactor(enabled: boolean): Promise<void> {
  await apiPut("/auth/2fa", { enabled })
}

export async function login(
  email: string,
  password: string
): Promise<{ token: string }> {
  const res = await apiPost<{ token: string }>("/auth/login", {
    email,
    password,
  })
  if (res?.token) {
    setAuthToken(res.token)
  }
  return res
}

export async function loginWithPasskey(
  credentialId?: string
): Promise<{ token: string }> {
  const res = await apiPost<{ token: string }>("/auth/passkey/login", {
    credentialId: credentialId || "",
  })
  if (res?.token) {
    setAuthToken(res.token)
  }
  return res
}

export async function logout(): Promise<void> {
  try {
    await apiPost("/auth/logout")
  } catch {
    // Ignore network failures during sign-out
  }
  setAuthToken(null)
}

export async function getSessions(): Promise<UserSession[]> {
  const data = await apiGet<ApiSession[]>("/auth/sessions")
  return data.map((session) => ({
    id: session.id,
    device: session.device || "Browser Session",
    browser: session.userAgent || "Unknown client",
    ipAddress: session.ipAddress,
    location: session.location || "Unknown location",
    lastActive: session.lastActive || "Just now",
    isCurrent: session.current,
  }))
}

export async function revokeSession(id: string): Promise<void> {
  await apiDelete(`/auth/sessions/${id}`)
}

export async function revokeAllOtherSessions(): Promise<void> {
  await apiPost("/auth/sessions/revoke-others")
}

export async function getPasskeys(): Promise<UserPasskey[]> {
  const data = await apiGet<ApiPasskey[]>("/auth/passkeys")
  return data.map((passkey, index) => ({
    id: passkey.id,
    name: passkey.name,
    credentialId: passkey.credentialId || "",
    createdAt: passkey.createdAt,
    lastUsedAt: passkey.lastUsedAt || "Never",
    type: index % 2 === 0 ? "touch_id" : "security_key",
  }))
}

export async function addPasskey(
  name: string,
  credentialId?: string
): Promise<void> {
  await apiPost("/auth/passkeys", { name, credentialId })
}

export async function removePasskey(id: string): Promise<void> {
  await apiDelete(`/auth/passkeys/${id}`)
}
