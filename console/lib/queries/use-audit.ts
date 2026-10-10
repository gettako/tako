'use client';

import { useQuery } from '@tanstack/react-query';
import { auditKeys } from './keys';
import { getAuditLogs } from '@/lib/api/audit';
import { AuditLog } from '@/lib/types';

export function useAuditLogs(options?: { refetchInterval?: number | false }) {
  return useQuery<AuditLog[]>({
    queryKey: auditKeys.all,
    queryFn: getAuditLogs,
    refetchInterval: options?.refetchInterval ?? 30000,
  });
}
