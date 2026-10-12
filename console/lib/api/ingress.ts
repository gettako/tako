import { TraefikAccessLogEntry } from '@/lib/types';

export interface IngressAccessLogFilters {
  nodeId?: string;
  serviceId?: string;
  status?: string;
  method?: string;
  search?: string;
  limit?: number;
}

export async function getIngressAccessLogs(
  filters: IngressAccessLogFilters = {}
): Promise<TraefikAccessLogEntry[]> {
  const params = new URLSearchParams();
  if (filters.nodeId && filters.nodeId !== 'all') params.append('nodeId', filters.nodeId);
  if (filters.serviceId && filters.serviceId !== 'all') params.append('serviceId', filters.serviceId);
  if (filters.status && filters.status !== 'all') params.append('status', filters.status);
  if (filters.method && filters.method !== 'all') params.append('method', filters.method);
  if (filters.search && filters.search.trim()) params.append('search', filters.search.trim());
  if (filters.limit) params.append('limit', String(filters.limit));

  const q = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`/api/ingress/access-logs${q}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch ingress access logs');
  }
  return res.json();
}
