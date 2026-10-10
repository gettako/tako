'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsKeys, userKeys, notificationKeys } from './keys';
import {
  getCurrentUser,
  getUsers,
  updateUserRole,
  deactivateUser,
  getUserInvites,
  createUserInvite,
  revokeUserInvite,
  getDomainSettings,
  updateDomainSettings,
  verifyDomainAndSSL,
  getGitProviders,
  getSyncedRepos,
  syncGitRepos,
  connectGitProviderWithPAT,
  getS3Buckets,
  addS3Bucket,
  updateS3Bucket,
  deleteS3Bucket,
  setDefaultS3Bucket,
  testS3BucketConnection,
  getBackupSchedule,
  updateBackupSchedule,
  getBackupSnapshots,
  triggerManualBackup,
  restoreBackupSnapshot,
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/api/settings';
import {
  getGitHubAppConfig,
  disconnectGitHubApp,
  getGitHubAppManifest,
  convertGitHubAppManifestCode,
  syncGitHubInstallation,
  submitGitHubAppManifestForm,
} from '@/lib/api/github';

export { submitGitHubAppManifestForm };
import {
  User,
  UserRole,
  UserInvite,
  ClusterDomainSettings,
  DomainVerificationResult,
  GitProvider,
  SyncedRepo,
  GitHubAppConfig,
  GitHubAppManifest,
  S3Bucket,
  ClusterBackupSchedule,
  ClusterBackupSnapshot,
  NotificationSettings,
  Notification,
} from '@/lib/types';
import { toast } from 'sonner';

// User & Team
export function useCurrentUser() {
  return useQuery<User>({
    queryKey: userKeys.current(),
    queryFn: getCurrentUser,
  });
}

export function useUsers() {
  return useQuery<User[]>({
    queryKey: userKeys.lists(),
    queryFn: getUsers,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation<User, Error, { userId: string; role: UserRole }>({
    mutationFn: ({ userId, role }) => updateUserRole(userId, role),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success(`Role updated for ${updated.name || updated.email}`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update user role');
    },
  });
}

export function useDeactivateUser(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success('User deactivated');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to deactivate user');
    },
  });
}

export function useUserInvites() {
  return useQuery<UserInvite[]>({
    queryKey: userKeys.invites(),
    queryFn: getUserInvites,
  });
}

export function useCreateUserInvite(options?: { onSuccess?: (invite: UserInvite) => void }) {
  const queryClient = useQueryClient();

  return useMutation<UserInvite, Error, { email: string; role: UserRole; expiryDays?: number }>({
    mutationFn: ({ email, role, expiryDays }) => createUserInvite(email, role, expiryDays),
    onSuccess: (invite) => {
      queryClient.invalidateQueries({ queryKey: userKeys.invites() });
      toast.success(`Invite created for ${invite.email}`);
      options?.onSuccess?.(invite);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create invite');
    },
  });
}

export function useRevokeUserInvite(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: revokeUserInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.invites() });
      toast.success('Invite revoked');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to revoke invite');
    },
  });
}

// Domain
export function useDomainSettings() {
  return useQuery<ClusterDomainSettings>({
    queryKey: settingsKeys.domain(),
    queryFn: getDomainSettings,
  });
}

export function useUpdateDomainSettings(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<ClusterDomainSettings, Error, Partial<ClusterDomainSettings>>({
    mutationFn: updateDomainSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.domain() });
      toast.success('Cluster domain settings updated');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update domain settings');
    },
  });
}

export function useVerifyDomainAndSSL() {
  return useMutation<DomainVerificationResult, Error, { domain: string; expectedIp?: string }>({
    mutationFn: ({ domain, expectedIp }) => verifyDomainAndSSL(domain, expectedIp),
  });
}

// Git & GitHub
export function useGitProviders(options?: { enabled?: boolean }) {
  return useQuery<GitProvider[]>({
    queryKey: settingsKeys.gitProviders(),
    queryFn: getGitProviders,
    enabled: options?.enabled ?? true,
  });
}

export function useSyncedRepos(options?: { enabled?: boolean }) {
  return useQuery<SyncedRepo[]>({
    queryKey: settingsKeys.syncedRepos(),
    queryFn: getSyncedRepos,
    enabled: options?.enabled ?? true,
  });
}

export function useSyncGitRepos() {
  const queryClient = useQueryClient();

  return useMutation<SyncedRepo[], Error, void>({
    mutationFn: syncGitRepos,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.syncedRepos() });
      toast.success('Repositories synchronized');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to sync repositories');
    },
  });
}

export function useConnectGitProviderWithPAT(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<
    { provider: GitProvider; repos: SyncedRepo[] },
    Error,
    { provider: 'github' | 'gitlab' | 'gitea'; username: string; token: string }
  >({
    mutationFn: connectGitProviderWithPAT,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.gitProviders() });
      queryClient.invalidateQueries({ queryKey: settingsKeys.syncedRepos() });
      toast.success(`Connected to ${data.provider.name}`);
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to connect Git provider');
    },
  });
}

export function useGitHubAppConfig(options?: { enabled?: boolean }) {
  return useQuery<GitHubAppConfig | null>({
    queryKey: settingsKeys.githubApp(),
    queryFn: getGitHubAppConfig,
    enabled: options?.enabled ?? true,
  });
}

export function useDisconnectGitHubApp(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: disconnectGitHubApp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.githubApp() });
      queryClient.invalidateQueries({ queryKey: settingsKeys.gitProviders() });
      queryClient.invalidateQueries({ queryKey: settingsKeys.syncedRepos() });
      toast.success('GitHub App disconnected');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to disconnect GitHub App');
    },
  });
}

export function useConvertGitHubAppManifestCode() {
  const queryClient = useQueryClient();

  return useMutation<GitHubAppConfig, Error, string>({
    mutationFn: (code) => convertGitHubAppManifestCode(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.githubApp() });
      queryClient.invalidateQueries({ queryKey: settingsKeys.gitProviders() });
      queryClient.invalidateQueries({ queryKey: settingsKeys.syncedRepos() });
      toast.success('GitHub App configuration connected');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to connect GitHub App');
    },
  });
}

export function useSyncGitHubInstallation() {
  const queryClient = useQueryClient();

  return useMutation<SyncedRepo[], Error, number | undefined>({
    mutationFn: (installationId) => syncGitHubInstallation(installationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.githubApp() });
      queryClient.invalidateQueries({ queryKey: settingsKeys.syncedRepos() });
      toast.success('GitHub installation synchronized');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to sync GitHub installation');
    },
  });
}

export function useGetGitHubAppManifest() {
  return useMutation<GitHubAppManifest, Error, { customName?: string; customSlug?: string }>({
    mutationFn: ({ customName, customSlug }) => getGitHubAppManifest(customName, customSlug),
    onError: (err) => {
      toast.error(err.message || 'Failed to generate GitHub App manifest');
    },
  });
}

// S3 Storage
export function useS3Buckets() {
  return useQuery<S3Bucket[]>({
    queryKey: settingsKeys.s3Buckets(),
    queryFn: getS3Buckets,
  });
}

export function useAddS3Bucket(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<S3Bucket, Error, Omit<S3Bucket, 'id' | 'createdAt'>>({
    mutationFn: addS3Bucket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.s3Buckets() });
      toast.success('S3 bucket added');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to add S3 bucket');
    },
  });
}

export function useUpdateS3Bucket(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<S3Bucket, Error, { id: string; input: Partial<Omit<S3Bucket, 'id' | 'createdAt'>> }>({
    mutationFn: ({ id, input }) => updateS3Bucket(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.s3Buckets() });
      toast.success('S3 bucket updated');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update S3 bucket');
    },
  });
}

export function useDeleteS3Bucket(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteS3Bucket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.s3Buckets() });
      toast.success('S3 bucket deleted');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete S3 bucket');
    },
  });
}

export function useSetDefaultS3Bucket() {
  const queryClient = useQueryClient();

  return useMutation<S3Bucket[], Error, string>({
    mutationFn: setDefaultS3Bucket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.s3Buckets() });
      toast.success('Default S3 bucket updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to set default bucket');
    },
  });
}

export function useTestS3BucketConnection() {
  return useMutation<{ ok: boolean; latencyMs: number; message: string }, Error, Partial<S3Bucket>>({
    mutationFn: testS3BucketConnection,
  });
}

// Backups & Snapshots
export function useBackupSchedule() {
  return useQuery<ClusterBackupSchedule>({
    queryKey: ['backup-schedule'],
    queryFn: getBackupSchedule,
  });
}

export function useUpdateBackupSchedule() {
  const queryClient = useQueryClient();

  return useMutation<ClusterBackupSchedule, Error, Partial<ClusterBackupSchedule>>({
    mutationFn: updateBackupSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-schedule'] });
      toast.success('Backup schedule updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update backup schedule');
    },
  });
}

export function useBackupSnapshots() {
  return useQuery<ClusterBackupSnapshot[]>({
    queryKey: ['backup-snapshots'],
    queryFn: getBackupSnapshots,
  });
}

export function useTriggerManualBackup(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<any, Error, void>({
    mutationFn: () => triggerManualBackup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-snapshots'] });
      toast.success('Cluster snapshot created');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create backup snapshot');
    },
  });
}

export function useRestoreBackupSnapshot(options?: { onSuccess?: () => void }) {
  return useMutation<{ ok: boolean; message: string }, Error, string>({
    mutationFn: restoreBackupSnapshot,
    onSuccess: (data) => {
      toast.success('Backup snapshot restored', { description: data.message });
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to restore snapshot');
    },
  });
}

// Notifications
export function useNotificationSettings() {
  return useQuery<NotificationSettings>({
    queryKey: notificationKeys.settings(),
    queryFn: getNotificationSettings,
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation<NotificationSettings, Error, NotificationSettings>({
    mutationFn: updateNotificationSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.settings() });
      toast.success('Notification settings saved');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update notification settings');
    },
  });
}

export function useSendTestNotification() {
  return useMutation<{ success: boolean; message: string }, Error, 'email' | 'slack' | 'discord' | 'telegram'>({
    mutationFn: sendTestNotification,
    onSuccess: (data) => {
      toast.success('Test notification sent', { description: data.message });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to send test notification');
    },
  });
}

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: notificationKeys.list(),
    queryFn: getNotifications,
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      toast.success('All notifications marked as read');
    },
  });
}
