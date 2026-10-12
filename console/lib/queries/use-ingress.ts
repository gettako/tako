'use client';

import { useQuery } from '@tanstack/react-query';
import { getIngressAccessLogs, IngressAccessLogFilters } from '@/lib/api/ingress';
import { TraefikAccessLogEntry } from '@/lib/types';

export function useIngressAccessLogs(
  filters: IngressAccessLogFilters = {},
  options?: { refetchInterval?: number | false; enabled?: boolean }
) {
  return useQuery<TraefikAccessLogEntry[]>({
    queryKey: ['ingress', 'access-logs', filters],
    queryFn: () => getIngressAccessLogs(filters),
    refetchInterval: options?.refetchInterval ?? 3000,
    enabled: options?.enabled ?? true,
  });
}
