import { AuditLog } from '@/lib/types';

export async function getAuditLogs(): Promise<AuditLog[]> {
  const res = await fetch('/api/audit-logs');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch audit logs');
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function logAuditEvent(event: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
  const res = await fetch('/api/audit-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to record audit log');
  }
  return res.json();
}
