'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Node } from '@/lib/types';
import { getNodeEventsStreamUrl } from '@/lib/api/nodes';

export function useNodeEvents() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const es = new EventSource(getNodeEventsStreamUrl());
    eventSourceRef.current = es;

    // Handle initial snapshot
    es.addEventListener('snapshot', (e) => {
      try {
        const nodes = JSON.parse(e.data) as Node[];
        if (Array.isArray(nodes) && nodes.length > 0) {
          queryClient.setQueryData(['nodes'], nodes);
        }
      } catch {
        // Ignore parse error
      }
    });

    // Handle status change
    es.addEventListener('node.status_changed', (e) => {
      try {
        const payload = JSON.parse(e.data);
        queryClient.setQueryData<Node[]>(['nodes'], (old) => {
          if (!old) return old;
          return old.map((n) =>
            n.id === payload.node_id
              ? { ...n, status: payload.status }
              : n
          );
        });
      } catch {
        // Ignore parse error
      }
    });

    // Handle live metrics with 500ms coalescing buffer
    const metricsBuffer = new Map<string, any>();
    let metricsTimer: ReturnType<typeof setTimeout> | null = null;

    const flushMetrics = () => {
      if (metricsBuffer.size === 0) return;
      const snapshot = new Map(metricsBuffer);
      metricsBuffer.clear();
      metricsTimer = null;

      queryClient.setQueryData<Node[]>(['nodes'], (old) => {
        if (!old) return old;
        return old.map((n) => {
          const payload = snapshot.get(n.id);
          if (!payload) return n;
          return {
            ...n,
            usage: {
              ...n.usage,
              cpuPercent: payload.cpu_percent,
              memoryUsedMb: payload.memory_used_mb,
              diskUsedGb: payload.disk_used_gb,
              networkRxKbps: payload.network_rx_kbps,
              networkTxKbps: payload.network_tx_kbps,
            },
          };
        });
      });
    };

    es.addEventListener('node.metrics', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload && payload.node_id) {
          metricsBuffer.set(payload.node_id, payload);
          if (!metricsTimer) {
            metricsTimer = setTimeout(flushMetrics, 500);
          }
        }
      } catch {
        // Ignore parse error
      }
    });

    return () => {
      if (metricsTimer) {
        clearTimeout(metricsTimer);
        metricsTimer = null;
      }
      flushMetrics();
      es.close();
      eventSourceRef.current = null;
    };
  }, [queryClient]);
}
