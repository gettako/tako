import fs from 'fs';
import path from 'path';
import {
  mockDomainSettings,
  mockS3Buckets,
  mockBackupSchedule,
  mockNotificationSettings,
  mockNotifications,
  mockUsers,
} from '@/lib/mock/data';

const CACHE_FILE = path.join(process.cwd(), '.next', 'tako-settings-cache.json');

const defaultSettings: Record<string, unknown> = {
  domain_settings: { ...mockDomainSettings },
  s3_buckets: [...mockS3Buckets],
  backup_schedule: { ...mockBackupSchedule },
  notification_settings: { ...mockNotificationSettings },
  cluster_notifications: [...mockNotifications],
  team_users: [...mockUsers],
  user_invites: [],
};

let memoryStore: Record<string, unknown> = { ...defaultSettings };

// Try reading initial cache from disk if available
try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      memoryStore = { ...defaultSettings, ...parsed };
    }
  }
} catch {
  // Use memory store
}

function persistToDisk() {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (fs.existsSync(dir)) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
    }
  } catch {
    // Ignore in read-only or restricted environments
  }
}

export function getSettingFallback(key: string): unknown {
  return memoryStore[key] ?? null;
}

export function setSettingFallback(key: string, value: unknown): void {
  memoryStore[key] = value;
  persistToDisk();
}

export function getAllSettingsFallback(): Record<string, unknown> {
  return { ...memoryStore };
}
