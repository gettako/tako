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
  DomainVerificationResult,
  NotificationSettings,
  Notification,
} from '@/lib/types';
import { getUserAvatarUrl } from '@/lib/avatar';
import { sanitizeDomain } from '@/lib/utils/domain-validator';

let currentUser = { ...mockCurrentUser };
let users = [...mockUsers];
let invites: UserInvite[] = [];
let sessions = [...mockSessions];
let passkeys = [...mockPasskeys];
let buckets = [...mockS3Buckets];
let providers: GitProvider[] = [];
let syncedRepos: SyncedRepo[] = [];
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

/* --- Current User, Profile, Sessions & Passkeys (extracted to ./profile) --- */
export * from './profile';


/* --- Users & Team RBAC --- */
export async function getUsers(): Promise<User[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          users = data.map((u: Partial<User>) => ({
            id: u.id || `usr-${Math.random().toString(36).slice(2, 8)}`,
            name: u.name || 'User',
            email: u.email || 'user@gettako.dev',
            role: (u.role as UserRole) || 'member',
            avatarUrl: getUserAvatarUrl(u.email || '', u.avatarUrl),
            twoFactorEnabled: !!u.twoFactorEnabled,
            createdAt: u.createdAt || new Date().toISOString(),
          }));
          saveSettingToBFF('team_users', users).catch(() => {});
          return [...users];
        }
      }
    } catch {
      // Fallback
    }

    // Try BFF cached team_users before mock
    const cached = await fetchSettingFromBFF<User[]>('team_users', []);
    if (Array.isArray(cached) && cached.length > 0) {
      users = cached.map((u) => ({
        ...u,
        avatarUrl: getUserAvatarUrl(u.email || '', u.avatarUrl),
      }));
      return [...users];
    }
  }
  await simulateDelay();
  return [...users];
}

export async function updateUserRole(userId: string, role: UserRole): Promise<User> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        const updated = await res.json();
        const idx = users.findIndex((u) => u.id === userId);
        if (idx !== -1) {
          users[idx] = { ...users[idx], role };
        }
        saveSettingToBFF('team_users', users).catch(() => {});
        return {
          id: updated.id || userId,
          name: updated.name || '',
          email: updated.email || '',
          role: updated.role || role,
          avatarUrl: getUserAvatarUrl(updated.email || '', updated.avatarUrl),
          twoFactorEnabled: !!updated.twoFactorEnabled,
          createdAt: updated.createdAt || new Date().toISOString(),
        };
      }
    } catch {
      // Fallback
    }
  }
  await simulateDelay();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('User not found');
  users[idx] = { ...users[idx], role };
  if (users[idx].id === currentUser.id) {
    currentUser.role = role;
  }
  saveSettingToBFF('team_users', users).catch(() => {});
  return { ...users[idx] };
}

export async function deactivateUser(userId: string): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/auth/users/${userId}`, { method: 'DELETE' });
    } catch {
      // Fallback
    }
  }
  await simulateDelay();
  users = users.filter((u) => u.id !== userId);
  await saveSettingToBFF('team_users', users).catch(() => {});
}

export async function getUserInvites(): Promise<UserInvite[]> {
  const remote = await fetchSettingFromBFF<UserInvite[]>('user_invites', []);
  if (Array.isArray(remote)) {
    invites = remote;
  }
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
  invites = [newInvite, ...invites.filter((i) => i.email !== email)];
  await saveSettingToBFF('user_invites', invites);

  // Also provision the user record in database if online
  if (typeof window !== 'undefined') {
    fetch('/api/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: email.split('@')[0],
        email,
        role,
      }),
    }).catch(() => {});
  }

  return { ...newInvite };
}

export async function revokeUserInvite(inviteId: string): Promise<void> {
  await simulateDelay();
  invites = invites.filter((i) => i.id !== inviteId);
  await saveSettingToBFF('user_invites', invites);
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
  const remote = await fetchSettingFromBFF<GitProvider[]>('git_providers', []);
  if (Array.isArray(remote)) {
    providers = remote;
    return [...remote];
  }
  return [];
}

export async function getSyncedRepos(): Promise<SyncedRepo[]> {
  const remote = await fetchSettingFromBFF<SyncedRepo[]>('synced_repos', []);
  if (Array.isArray(remote)) {
    syncedRepos = remote;
    return [...remote];
  }
  return [];
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
        if (Array.isArray(repos)) {
          syncedRepos = repos;
          return repos;
        }
      }
    } catch {
      // fallback
    }
  }
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
    domainSettings = {
      ...domainSettings,
      ...remote,
      domain: sanitizeDomain(remote.domain),
    };
  }
  await simulateDelay();
  return { ...domainSettings };
}

export async function updateDomainSettings(input: Partial<ClusterDomainSettings>): Promise<ClusterDomainSettings> {
  await simulateDelay();
  const cleanInput = { ...input };
  if (cleanInput.domain) {
    cleanInput.domain = sanitizeDomain(cleanInput.domain);
  }
  domainSettings = { ...domainSettings, ...cleanInput };
  await saveSettingToBFF('domain_settings', domainSettings);
  return { ...domainSettings };
}

export async function verifyDomainAndSSL(
  domain: string,
  expectedIp?: string
): Promise<DomainVerificationResult> {
  const sanitized = sanitizeDomain(domain);

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/settings/domain/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: sanitized, expectedIp }),
      });
      if (res.ok) {
        const data = (await res.json()) as DomainVerificationResult;
        domainSettings = {
          ...domainSettings,
          domain: data.domain,
          dnsVerified: data.dnsVerified,
          sslActive: data.sslActive,
          sslStatus: data.sslStatus,
          sslIssuer: data.sslIssuer,
          sslExpiresAt: data.sslExpiresAt,
          lastCheckedAt: data.lastCheckedAt,
        };
        return data;
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay(300, 500);
  const isMatch = !expectedIp || expectedIp === '127.0.0.1' || sanitized.includes(expectedIp.replace(/\./g, '-'));
  const fallbackResult: DomainVerificationResult = {
    domain: sanitized,
    valid: true,
    dnsVerified: isMatch,
    resolvedIps: expectedIp ? [expectedIp] : ['127.0.0.1'],
    expectedIp: expectedIp || '127.0.0.1',
    sslActive: true,
    sslStatus: isMatch ? 'active' : 'pending_dns',
    sslIssuer: "Let's Encrypt Authority X3",
    sslExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
    message: isMatch
      ? `DNS pointer verified. Let's Encrypt TLS certificate active for ${sanitized}.`
      : `DNS A record does not match expected leader IP (${expectedIp}).`,
    lastCheckedAt: new Date().toISOString(),
  };

  domainSettings = {
    ...domainSettings,
    ...fallbackResult,
  };
  saveSettingToBFF('domain_settings', domainSettings).catch(() => {});

  return fallbackResult;
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
  const remote = await fetchSettingFromBFF<Notification[]>('cluster_notifications', notifications);
  if (Array.isArray(remote) && remote.length > 0) {
    notifications = remote;
  }
  await simulateDelay(50, 150);
  return [...notifications];
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await simulateDelay(50, 100);
  notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
  await saveSettingToBFF('cluster_notifications', notifications);
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await simulateDelay(50, 100);
  notifications = notifications.map((n) => ({ ...n, read: true }));
  await saveSettingToBFF('cluster_notifications', notifications);
}
