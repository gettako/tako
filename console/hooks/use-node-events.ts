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

    // Handle live metrics
    es.addEventListener('node.metrics', (e) => {
      try {
        const payload = JSON.parse(e.data);
        queryClient.setQueryData<Node[]>(['nodes'], (old) => {
          if (!old) return old;
          return old.map((n) => {
            if (n.id !== payload.node_id) return n;
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
      } catch {
        // Ignore parse error
      }
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [queryClient]);
}
