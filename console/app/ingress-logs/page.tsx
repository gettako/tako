'use client';

import React from 'react';
import { IngressLogsViewer } from '@/components/ingress/ingress-logs-viewer';

export default function IngressLogsPage() {
  return (
    <>
      <title>Traefik Ingress Access Logs — Takō Cloud</title>
      <div className="flex flex-col gap-6">
        {/* Page Header (Base Vega Standard: No icon in title, clean & compact) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
                Traefik Ingress Logs
              </h1>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-status-success/30 bg-status-success/10 px-2.5 py-0.5 text-xs font-medium text-status-success">
                <span className="size-1.5 rounded-full bg-status-success animate-pulse" />
                <span>Live Edge Telemetry</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Real-time HTTP reverse-proxy ingress traffic across cluster nodes with multi-dimensional filtering.
            </p>
          </div>
        </div>

        {/* Global Ingress Logs Viewer */}
        <IngressLogsViewer />
      </div>
    </>
  );
}
