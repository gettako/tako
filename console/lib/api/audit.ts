import { simulateDelay } from './delay';
import { mockAuditLogs } from '@/lib/mock/data';
import { AuditLog } from '@/lib/types';

let auditLogs = [...mockAuditLogs];

export function setAuditLogsMockData(newLogs: AuditLog[]): void {
  auditLogs = [...newLogs];
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  await simulateDelay();
  return [...auditLogs];
}

export async function logAuditEvent(event: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
  const newLog: AuditLog = {
    ...event,
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
  auditLogs.unshift(newLog);
  return newLog;
}
