import { simulateDelay } from './delay';
import {
  mockCurrentUser,
  mockUsers,
  mockUserInvites,
  mockSessions,
  mockPasskeys,
  mockS3Buckets,
  mockGitProviders,
  mockSyncedRepos,
  mockBackupSchedule,
  mockDomainSettings,
  mockNotificationSettings,
  mockNotifications,
} from '@/lib/mock/data';
import {
  User,
  UserRole,
  UserInvite,
  Session,
  Passkey,
  S3Bucket,
  GitProvider,
  SyncedRepo,
  ClusterBackupSchedule,
  ClusterDomainSettings,
  NotificationSettings,
  Notification,
} from '@/lib/types';

let currentUser = { ...mockCurrentUser };
let users = [...mockUsers];
let invites = [...mockUserInvites];
let sessions = [...mockSessions];
let passkeys = [...mockPasskeys];
let buckets = [...mockS3Buckets];
let providers = [...mockGitProviders];
let syncedRepos = [...mockSyncedRepos];
let backupSchedule = { ...mockBackupSchedule };
let domainSettings = { ...mockDomainSettings };
let notificationSettings = { ...mockNotificationSettings };
let notifications = [...mockNotifications];

async function fetchSettingFromBFF<T>(key: string, fallback: T): Promise<T> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/settings/${key}`);
      if (res.ok) {
        const data = await res.json();
        if (data !== undefined && data !== null) {
          return data as T;
        }
      }
    } catch {
      // Fallback
    }
  }
  return fallback;
}

async function saveSettingToBFF<T>(key: string, value: T): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
    } catch {
      // Fallback
    }
  }
}

/* --- Current User & Profile --- */
export async function getCurrentUser(): Promise<User> {
  await simulateDelay(50, 150);
  return { ...currentUser };
}

export async function updateCurrentUser(input: Partial<User>): Promise<User> {
  await simulateDelay();
  currentUser = { ...currentUser, ...input };
  const idx = users.findIndex((u) => u.id === currentUser.id);
  if (idx !== -1) users[idx] = { ...currentUser };
  return { ...currentUser };
}

/* --- Sessions --- */
export async function getSessions(): Promise<Session[]> {
  await simulateDelay();
  return [...sessions];
}

export async function revokeSession(sessionId: string): Promise<void> {
  await simulateDelay();
  sessions = sessions.filter((s) => s.id !== sessionId);
}

export async function revokeAllOtherSessions(currentSessionId: string): Promise<void> {
  await simulateDelay();
  sessions = sessions.filter((s) => s.id === currentSessionId);
}

/* --- Passkeys --- */
export async function getPasskeys(): Promise<Passkey[]> {
  await simulateDelay();
  return [...passkeys];
}

export async function addPasskey(name: string): Promise<Passkey> {
  await simulateDelay(200, 400);
  const newKey: Passkey = {
    id: `pk-${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
    lastUsedAt: 'Just now',
  };
  passkeys.push(newKey);
  return { ...newKey };
}

export async function deletePasskey(id: string): Promise<void> {
  await simulateDelay();
  passkeys = passkeys.filter((p) => p.id !== id);
}

/* --- Users & Team RBAC --- */
export async function getUsers(): Promise<User[]> {
  await simulateDelay();
  return [...users];
}

export async function updateUserRole(userId: string, role: UserRole): Promise<User> {
  await simulateDelay();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('User not found');
  users[idx] = { ...users[idx], role };
  if (users[idx].id === currentUser.id) {
    currentUser.role = role;
  }
  return { ...users[idx] };
}

export async function deactivateUser(userId: string): Promise<void> {
  await simulateDelay();
  users = users.filter((u) => u.id !== userId);
}

export async function getUserInvites(): Promise<UserInvite[]> {
  await simulateDelay();
  return [...invites];
}

export async function createUserInvite(email: string, role: UserRole, expiryDays: number = 7): Promise<UserInvite> {
  await simulateDelay();
  const newInvite: UserInvite = {
    id: `inv-${Date.now()}`,
    email,
    role,
    token: `takoinv_${Math.random().toString(36).substring(2, 12)}`,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * expiryDays).toISOString(),
    createdAt: new Date().toISOString(),
  };
  invites.unshift(newInvite);
  return { ...newInvite };
}

export async function revokeUserInvite(inviteId: string): Promise<void> {
  await simulateDelay();
  invites = invites.filter((i) => i.id !== inviteId);
}

/* --- S3 Buckets --- */
export async function getS3Buckets(): Promise<S3Bucket[]> {
  const remote = await fetchSettingFromBFF<S3Bucket[]>('s3_buckets', buckets);
  if (Array.isArray(remote) && remote.length > 0) {
    buckets = remote;
  }
  await simulateDelay();
  return [...buckets];
}

export async function addS3Bucket(input: Omit<S3Bucket, 'id' | 'createdAt'>): Promise<S3Bucket> {
  await simulateDelay();
  const newBucket: S3Bucket = {
    ...input,
    id: `s3-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  buckets.push(newBucket);
  await saveSettingToBFF('s3_buckets', buckets);
  return { ...newBucket };
}

export async function testS3BucketConnection(bucket: Partial<S3Bucket>): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  await simulateDelay(250, 450);
  const isHealthy = !bucket.endpoint?.includes('invalid');
  return {
    ok: isHealthy,
    latencyMs: Math.round(40 + Math.random() * 30),
    message: isHealthy
      ? 'S3 connection handshake verified. HeadBucket OK.'
      : 'Connection timed out. Verify endpoint and access keys.',
  };
}

/* --- Git Integration --- */
export async function getGitProviders(): Promise<GitProvider[]> {
  const remote = await fetchSettingFromBFF<GitProvider[]>('git_providers', providers);
  if (Array.isArray(remote) && remote.length > 0) {
    providers = remote;
  }
  await simulateDelay();
  return [...providers];
}

export async function getSyncedRepos(): Promise<SyncedRepo[]> {
  const remote = await fetchSettingFromBFF<SyncedRepo[]>('synced_repos', syncedRepos);
  if (Array.isArray(remote) && remote.length > 0) {
    syncedRepos = remote;
  }
  await simulateDelay();
  return [...syncedRepos];
}

export async function syncGitRepos(): Promise<SyncedRepo[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/github/installations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const repos = await res.json();
        if (Array.isArray(repos) && repos.length > 0) {
          syncedRepos = repos;
          return repos;
        }
      }
    } catch {
      // fallback
    }
  }
  await simulateDelay(350, 600);
  return [...syncedRepos];
}

/* --- Backups --- */
export async function getBackupSchedule(): Promise<ClusterBackupSchedule> {
  const remote = await fetchSettingFromBFF<ClusterBackupSchedule>('backup_schedule', backupSchedule);
  if (remote && remote.frequency) {
    backupSchedule = remote;
  }
  await simulateDelay();
  return { ...backupSchedule };
}

export async function updateBackupSchedule(input: Partial<ClusterBackupSchedule>): Promise<ClusterBackupSchedule> {
  await simulateDelay();
  backupSchedule = { ...backupSchedule, ...input };
  await saveSettingToBFF('backup_schedule', backupSchedule);
  return { ...backupSchedule };
}

export async function triggerManualBackup(): Promise<{ ok: boolean; snapshotSizeMb: number; durationMs: number }> {
  await simulateDelay(500, 900);
  backupSchedule.lastBackupAt = new Date().toISOString();
  backupSchedule.lastBackupStatus = 'success';
  await saveSettingToBFF('backup_schedule', backupSchedule);
  return {
    ok: true,
    snapshotSizeMb: 142.5,
    durationMs: 780,
  };
}

/* --- Domain --- */
export async function getDomainSettings(): Promise<ClusterDomainSettings> {
  const remote = await fetchSettingFromBFF<ClusterDomainSettings>('domain_settings', domainSettings);
  if (remote && remote.domain) {
    domainSettings = remote;
  }
  await simulateDelay();
  return { ...domainSettings };
}

export async function updateDomainSettings(input: Partial<ClusterDomainSettings>): Promise<ClusterDomainSettings> {
  await simulateDelay();
  domainSettings = { ...domainSettings, ...input };
  await saveSettingToBFF('domain_settings', domainSettings);
  return { ...domainSettings };
}

/* --- Notifications --- */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const remote = await fetchSettingFromBFF<NotificationSettings>('notification_settings', notificationSettings);
  if (remote && (remote.email || remote.slack || remote.telegram)) {
    notificationSettings = remote;
  }
  await simulateDelay();
  return { ...notificationSettings };
}

export async function updateNotificationSettings(input: NotificationSettings): Promise<NotificationSettings> {
  await simulateDelay();
  notificationSettings = { ...input };
  await saveSettingToBFF('notification_settings', notificationSettings);
  return { ...notificationSettings };
}

export function setNotificationsMockData(newNotifs: Notification[]): void {
  notifications = [...newNotifs];
}

export async function getNotifications(): Promise<Notification[]> {
  await simulateDelay(50, 150);
  return [...notifications];
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await simulateDelay(50, 100);
  notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await simulateDelay(50, 100);
  notifications = notifications.map((n) => ({ ...n, read: true }));
}
