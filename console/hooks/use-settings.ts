"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  addDockerRegistry,
  addUserInvite,
  checkSystemVersion,
  connectGitProvider,
  createSnapshot,
  deleteDockerRegistry,
  deleteUser,
  disconnectGitProvider,
  getGitProviders,
  getRegistries,
  getSettings,
  getSnapshots,
  getSyncedRepos,
  getSystemVersion,
  getUserInvites,
  getUsers,
  restoreSnapshot,
  revokeUserInvite,
  syncGitRepos,
  testNotifications,
  testS3Bucket,
  toggleRepoAutoDeploy,
  updateBackupSchedule,
  updateSettings,
  updateSystem,
  updateUserRole,
} from "@/services/settings.service"
import type {
  BackupScheduleConfig,
  DockerRegistryConfig,
  GitProviderConfig,
  PlatformSettings,
  S3BucketConfig,
} from "@/types/platform"

export const settingsKeys = {
  all: ["settings"] as const,
  list: (filters?: object) => [...settingsKeys.all, "list", filters] as const,
  detail: (id: string) => [...settingsKeys.all, "detail", id] as const,
  snapshots: () => [...settingsKeys.all, "snapshots"] as const,
  registries: () => [...settingsKeys.all, "registries"] as const,
  users: () => [...settingsKeys.all, "users"] as const,
  invites: () => [...settingsKeys.all, "invites"] as const,
  gitProviders: () => [...settingsKeys.all, "gitProviders"] as const,
  syncedRepos: () => [...settingsKeys.all, "syncedRepos"] as const,
  systemVersion: () => [...settingsKeys.all, "systemVersion"] as const,
}

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.detail("current"),
    queryFn: () => getSettings(),
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (updates: Partial<PlatformSettings>) => updateSettings(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}

export function useSnapshots() {
  return useQuery({
    queryKey: settingsKeys.snapshots(),
    queryFn: () => getSnapshots(),
  })
}

export function useCreateSnapshot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => createSnapshot(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.snapshots() })
    },
  })
}

export function useRestoreSnapshot() {
  return useMutation({
    mutationFn: (filename: string) => restoreSnapshot(filename),
  })
}

export function useUpdateBackupSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (schedule: Partial<BackupScheduleConfig>) =>
      updateBackupSchedule(schedule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}

export function useRegistries() {
  return useQuery({
    queryKey: settingsKeys.registries(),
    queryFn: () => getRegistries(),
  })
}

export function useAddRegistry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (
      registry: Omit<DockerRegistryConfig, "id" | "createdAt" | "updatedAt">
    ) => addDockerRegistry(registry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.registries() })
    },
  })
}

export function useDeleteRegistry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteDockerRegistry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.registries() })
    },
  })
}

export function useUsers() {
  return useQuery({
    queryKey: settingsKeys.users(),
    queryFn: () => getUsers(),
  })
}

export function useUserInvites() {
  return useQuery({
    queryKey: settingsKeys.invites(),
    queryFn: () => getUserInvites(),
  })
}

export function useAddUserInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      email,
      role,
      expiryDays,
    }: {
      email: string
      role: string
      expiryDays?: number
    }) => addUserInvite(email, role, expiryDays),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.invites() })
    },
  })
}

export function useRevokeUserInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => revokeUserInvite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.invites() })
    },
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.users() })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.users() })
    },
  })
}

export function useGitProviders() {
  return useQuery({
    queryKey: settingsKeys.gitProviders(),
    queryFn: () => getGitProviders(),
  })
}

export function useConnectGitProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (provider: Partial<GitProviderConfig>) =>
      connectGitProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.gitProviders() })
    },
  })
}

export function useDisconnectGitProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => disconnectGitProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.gitProviders() })
    },
  })
}

export function useSyncedRepos() {
  return useQuery({
    queryKey: settingsKeys.syncedRepos(),
    queryFn: () => getSyncedRepos(),
  })
}

export function useSyncGitRepos() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => syncGitRepos(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.syncedRepos() })
    },
  })
}

export function useToggleRepoAutoDeploy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, autoDeploy }: { id: string; autoDeploy: boolean }) =>
      toggleRepoAutoDeploy(id, autoDeploy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.syncedRepos() })
    },
  })
}

export function useSystemVersion() {
  return useQuery({
    queryKey: settingsKeys.systemVersion(),
    queryFn: () => getSystemVersion(),
  })
}

export function useCheckSystemVersion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => checkSystemVersion(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: settingsKeys.systemVersion(),
      })
    },
  })
}

export function useUpdateSystem() {
  return useMutation({
    mutationFn: (target: string) => updateSystem(target),
  })
}

export function useTestS3Bucket() {
  return useMutation({
    mutationFn: (bucket: Partial<S3BucketConfig>) => testS3Bucket(bucket),
  })
}

export function useTestNotifications() {
  return useMutation({
    mutationFn: (config?: Record<string, unknown>) => testNotifications(config),
  })
}

