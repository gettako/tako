export type UserRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  device: string;
  location: string;
  current: boolean;
  lastActive: string;
}

export interface Passkey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface UserInvite {
  id: string;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface S3Bucket {
  id: string;
  name: string;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface GitProvider {
  id: string;
  type: 'github' | 'gitlab' | 'bitbucket';
  name: string;
  username: string;
  connected: boolean;
  avatarUrl?: string;
  connectedAt: string;
}

export interface SyncedRepo {
  id: string;
  providerId: string;
  installationId?: number;
  account?: string;
  accountType?: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  updatedAt: string;
}

export interface ClusterBackupSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  timeUtc: string;
  retentionDays: number;
  destinationBucketId: string;
  lastBackupAt?: string;
  lastBackupStatus?: 'success' | 'failed';
}

export interface ClusterDomainSettings {
  domain: string;
  sslActive: boolean;
  sslAutoRenew: boolean;
  customDnsIp?: string;
  sslStatus?: 'active' | 'pending_dns' | 'pending_acme' | 'error';
  sslIssuer?: string;
  sslExpiresAt?: string;
  dnsVerified?: boolean;
  lastCheckedAt?: string;
}

export interface DomainVerificationResult {
  domain: string;
  valid: boolean;
  dnsVerified: boolean;
  resolvedIps: string[];
  expectedIp: string;
  sslActive: boolean;
  sslStatus: 'active' | 'pending_dns' | 'pending_acme' | 'error';
  sslIssuer?: string;
  sslExpiresAt?: string;
  message: string;
  lastCheckedAt: string;
}

export interface NotificationSettings {
  email: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    fromEmail: string;
  };
  slack: {
    enabled: boolean;
    webhookUrl: string;
    channelName: string;
  };
  telegram: {
    enabled: boolean;
    botToken: string;
    chatId: string;
  };
}

export interface GitHubAppManifest {
  name: string;
  description?: string;
  url: string;
  hook_attributes: {
    url: string;
    active?: boolean;
    secret?: string;
  };
  redirect_url: string;
  callback_urls?: string[];
  setup_url?: string;
  public?: boolean;
  default_permissions: Record<string, string>;
  default_events: string[];
}

export interface GitHubAppOwner {
  login: string;
  avatarUrl?: string;
  type: string;
  htmlUrl?: string;
}

export interface GitHubAppConfig {
  appId: number;
  slug: string;
  name: string;
  clientId: string;
  clientSecret?: string;
  webhookSecret?: string;
  privateKey?: string;
  owner?: GitHubAppOwner;
  htmlUrl: string;
  installUrl: string;
  installationId?: number;
  installations?: Array<{
    id: number;
    account: GitHubAppOwner;
    repositorySelection?: 'all' | 'selected';
    installedAt?: string;
  }>;
  connected?: boolean;
  createdAt: string;
  updatedAt: string;
}

