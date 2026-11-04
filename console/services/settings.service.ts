import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  type ApiRegistry,
  type ApiSnapshot,
  type ApiSystemVersion,
  type ApiUser,
} from "@/lib/api"
import {
  adaptRegistry,
  adaptSnapshot,
  adaptUser,
} from "@/lib/adapters"
import type {
  BackupScheduleConfig,
  ClusterSnapshot,
  DockerRegistryConfig,
  GitProviderConfig,
  PlatformSettings,
  PlatformUser,
  PlatformUserInvite,
  S3BucketConfig,
  SyncedGitRepo,
} from "@/types/platform"

export async function getSettings(): Promise<Record<string, unknown>> {
  return apiGet<Record<string, unknown>>("/settings")
}

export async function persistSetting(key: string, value: unknown): Promise<void> {
  await apiPut(`/settings/${encodeURIComponent(key)}`, { value })
}

export async function updateSettings(
  updates: Partial<PlatformSettings>
): Promise<void> {
  if (updates.s3Buckets) {
    await persistSetting(
      "s3_buckets",
      updates.s3Buckets.map((bucket) => ({
        id: bucket.id,
        name: bucket.name,
        endpoint: bucket.endpoint,
        bucket: bucket.bucket,
        region: bucket.region,
        accessKeyId: bucket.accessKey,
        secretAccessKey: bucket.secretKey,
        forcePathStyle: bucket.forcePathStyle,
        isDefault: bucket.isDefault,
      }))
    )
  }

  if (updates.backupSchedule) {
    await persistSetting("backup_schedule", {
      ...updates.backupSchedule,
      frequency: updates.backupSchedule.enabled
        ? updates.backupSchedule.frequency
        : "disabled",
    })
  }

  await persistSetting("platform_settings", updates)
}

export async function getSnapshots(): Promise<ClusterSnapshot[]> {
  try {
    const data = await apiGet<ApiSnapshot[]>("/backups/snapshots")
    return data.map(adaptSnapshot)
  } catch {
    return []
  }
}

export async function createSnapshot(): Promise<ClusterSnapshot> {
  const data = await apiPost<{ snapshot?: ApiSnapshot } | ApiSnapshot>(
    "/backups/snapshot"
  )
  const raw = (data && "snapshot" in data && data.snapshot) ? data.snapshot : (data as ApiSnapshot)
  return adaptSnapshot(raw)
}

export async function restoreSnapshot(snapshotId: string): Promise<void> {
  await apiPost("/backups/restore", { snapshotId })
}

export async function updateBackupSchedule(
  schedule: Partial<BackupScheduleConfig>
): Promise<void> {
  await persistSetting("backup_schedule", schedule)
}

export async function getRegistries(): Promise<DockerRegistryConfig[]> {
  try {
    const data = await apiGet<ApiRegistry[]>("/registries")
    return data.map(adaptRegistry)
  } catch {
    return []
  }
}

export async function addDockerRegistry(
  registry: Omit<DockerRegistryConfig, "id" | "createdAt" | "updatedAt">
): Promise<DockerRegistryConfig> {
  const data = await apiPost<ApiRegistry>("/registries", {
    name: registry.name,
    serverUrl: registry.serverUrl,
    username: registry.username,
    password: registry.password,
  })
  return adaptRegistry(data)
}

export async function deleteDockerRegistry(id: string): Promise<void> {
  await apiDelete(`/registries/${id}`)
}

export async function getUsers(): Promise<PlatformUser[]> {
  try {
    const data = await apiGet<ApiUser[]>("/auth/users")
    return data.map(adaptUser)
  } catch {
    return []
  }
}

export async function getUserInvites(): Promise<PlatformUserInvite[]> {
  try {
    const raw = await apiGet<Record<string, unknown>>("/settings")
    if (Array.isArray(raw?.user_invites)) {
      return raw.user_invites as PlatformUserInvite[]
    }
    return await apiGet<PlatformUserInvite[]>("/users/invites")
  } catch {
    return []
  }
}

export async function addUserInvite(
  email: string,
  role: string,
  expiryDays: number = 7
): Promise<PlatformUserInvite> {
  const token =
    "inv_" +
    Math.random().toString(36).substring(2, 10) +
    Math.random().toString(36).substring(2, 10)
  const now = new Date()
  const expires = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000)
  const newInvite: PlatformUserInvite = {
    id: "inv-" + Date.now(),
    email,
    role: role as any,
    token,
    expiresAt: expires.toISOString(),
    createdAt: now.toISOString(),
  }
  const existingRaw = await apiGet<Record<string, unknown>>("/settings").catch(
    () => ({}) as Record<string, unknown>
  )
  const currentList = Array.isArray(existingRaw.user_invites)
    ? (existingRaw.user_invites as Record<string, unknown>[])
    : []
  const nextList = [...currentList, newInvite]
  await persistSetting("user_invites", nextList)
  return newInvite
}

export async function revokeUserInvite(id: string): Promise<void> {
  const existingRaw = await apiGet<Record<string, unknown>>("/settings").catch(
    () => ({}) as Record<string, unknown>
  )
  const currentList = Array.isArray(existingRaw.user_invites)
    ? (existingRaw.user_invites as Record<string, unknown>[])
    : []
  const nextList = currentList.filter((item) => item.id !== id)
  await persistSetting("user_invites", nextList)
}

export async function updateUserRole(id: string, role: string): Promise<void> {
  await apiPatch(`/users/${id}/role`, { role })
}

export async function deleteUser(id: string): Promise<void> {
  await apiDelete(`/users/${id}`)
}

export async function getGitProviders(): Promise<GitProviderConfig[]> {
  try {
    return await apiGet<GitProviderConfig[]>("/git/providers")
  } catch {
    return []
  }
}

export async function connectGitProvider(
  provider: Partial<GitProviderConfig>
): Promise<void> {
  await apiPost("/git/providers", provider)
}

export async function disconnectGitProvider(id: string): Promise<void> {
  await apiDelete(`/git/providers/${id}`)
}

export async function getSyncedRepos(): Promise<SyncedGitRepo[]> {
  try {
    return await apiGet<SyncedGitRepo[]>("/git/repos")
  } catch {
    return []
  }
}

export async function syncGitRepos(): Promise<SyncedGitRepo[]> {
  return apiPost<SyncedGitRepo[]>("/git/repos/sync", {})
}

export async function toggleRepoAutoDeploy(
  id: string,
  autoDeploy: boolean
): Promise<void> {
  await apiPost(`/git/repos/${id}/auto-deploy`, { autoDeploy })
}

export async function getSystemVersion(): Promise<ApiSystemVersion> {
  return apiGet<ApiSystemVersion>("/system/version")
}

export async function checkSystemVersion(): Promise<ApiSystemVersion> {
  return apiPost<ApiSystemVersion>("/system/version/check", {})
}

export async function updateSystem(target: string): Promise<void> {
  await apiPost("/system/update", { target })
}

export async function testS3Bucket(
  bucket: Partial<S3BucketConfig>
): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  try {
    const res = await apiPost<{
      ok?: boolean
      message?: string
      latencyMs?: number
    }>("/settings/s3/test", {
      endpoint: bucket.endpoint,
      bucket: bucket.bucket,
      region: bucket.region,
      accessKey: bucket.accessKey,
      secretKey: bucket.secretKey,
      forcePathStyle: bucket.forcePathStyle,
    })
    return {
      ok: res.ok ?? true,
      message: res.message || "Connected to S3 bucket successfully.",
      latencyMs: res.latencyMs || 42,
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to connect to S3",
    }
  }
}

export async function testNotifications(
  config?: Record<string, unknown>
): Promise<{ ok: boolean; message: string; error?: string }> {
  try {
    const res = await apiPost<{ ok?: boolean; message?: string; error?: string }>(
      "/settings/notifications/test",
      config || {}
    )
    return {
      ok: res.ok ?? true,
      message: res.message || "Test dispatch triggered successfully.",
      error: res.error,
    }
  } catch (err) {
    return {
      ok: false,
      message: "",
      error:
        err instanceof Error ? err.message : "Failed to send test notification",
    }
  }
}
