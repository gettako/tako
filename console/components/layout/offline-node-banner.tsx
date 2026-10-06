'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { getNodes } from '@/lib/api/nodes';

export function OfflineNodeBanner() {
  const { data: nodes = [] } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
  });

  const offlineNodes = nodes.filter((n) => n.status === 'offline');

  if (offlineNodes.length === 0) {
    return null;
  }

  const count = offlineNodes.length;
  const names = offlineNodes.map((n) => n.name).join(', ');

  return (
    <div
      role="alert"
      className="bg-status-danger/10 border-b border-status-danger/25 text-status-danger px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-status-danger animate-pulse" />
          <span>
            <strong className="font-semibold">Cluster Alert:</strong> {count}{' '}
            {count === 1 ? 'node is' : 'nodes are'} currently offline ({names}). Workloads may be degraded.
          </span>
        </div>
        <Link
          href="/nodes"
          className="inline-flex items-center gap-1 font-semibold underline underline-offset-4 hover:opacity-85 transition-opacity shrink-0 active:not-aria-[haspopup]:translate-y-px"
        >
          <span>View Nodes</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
