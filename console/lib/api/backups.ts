import { simulateDelay } from './delay';
import { BackupItem } from '@/lib/types';

export type { BackupItem };

function getDefaultBackups(serviceSlug: string): BackupItem[] {
  return [
    {
      id: 'bk-1',
      name: `backup-${serviceSlug}-2026-10-05-0300.sql.gz`,
      sizeMb: 48.2,
      status: 'completed',
      createdAt: '2026-10-05T03:00:00Z',
    },
    {
      id: 'bk-2',
      name: `backup-${serviceSlug}-2026-10-04-0300.sql.gz`,
      sizeMb: 47.9,
      status: 'completed',
      createdAt: '2026-10-04T03:00:00Z',
    },
  ];
}

async function fetchFromBFF<T>(key: string, fallback: T): Promise<T> {
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
      // fallback
    }
  }
  return fallback;
}

async function saveToBFF<T>(key: string, value: T): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
    } catch {
      // fallback
    }
  }
}

export async function getServiceBackups(serviceId: string, serviceSlug = 'database'): Promise<BackupItem[]> {
  const fallback = getDefaultBackups(serviceSlug);
  const data = await fetchFromBFF<BackupItem[] | null>(`service_backups_${serviceId}`, null);
  if (Array.isArray(data) && data.length > 0) {
    return data;
  }
  return fallback;
}

export async function saveServiceBackups(serviceId: string, backups: BackupItem[]): Promise<void> {
  await saveToBFF(`service_backups_${serviceId}`, backups);
}

export async function createServiceBackup(serviceId: string, serviceSlug = 'database'): Promise<BackupItem> {
  await simulateDelay(600, 1000);
  const current = await getServiceBackups(serviceId, serviceSlug);
  const newBackup: BackupItem = {
    id: `bk-${Date.now()}`,
    name: `manual-${serviceSlug}-${new Date().toISOString().slice(0, 10)}.sql.gz`,
    sizeMb: 48.4,
    status: 'completed',
    createdAt: new Date().toISOString(),
  };
  const updated = [newBackup, ...current];
  await saveServiceBackups(serviceId, updated);
  return newBackup;
}

export async function deleteServiceBackup(serviceId: string, backupId: string, serviceSlug = 'database'): Promise<void> {
  const current = await getServiceBackups(serviceId, serviceSlug);
  const updated = current.filter((b) => b.id !== backupId);
  await saveServiceBackups(serviceId, updated);
}

export async function restoreServiceBackup(serviceId: string, backupName: string): Promise<void> {
  await simulateDelay(500, 800);
}
