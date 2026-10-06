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
