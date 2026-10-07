import { simulateDelay } from './delay';
import { mockAuditLogs } from '@/lib/mock/data';
import { AuditLog } from '@/lib/types';

let auditLogs = [...mockAuditLogs];

export function setAuditLogsMockData(newLogs: AuditLog[]): void {
  auditLogs = [...newLogs];
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch {
      // Fallback to in-memory
    }
  }

  await simulateDelay();
  return [...auditLogs];
}

export async function logAuditEvent(event: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (res.ok) {
        const saved = await res.json();
        if (saved && saved.id) {
          return saved;
        }
      }
    } catch {
      // Fallback
    }
  }

  const newLog: AuditLog = {
    ...event,
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
  auditLogs.unshift(newLog);
  return newLog;
}
