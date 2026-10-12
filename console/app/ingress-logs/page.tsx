'use client';

import React from 'react';
import { Globe, Radio, ShieldCheck } from 'lucide-react';
import { IngressLogsViewer } from '@/components/ingress/ingress-logs-viewer';

export default function IngressLogsPage() {
  return (
    <>
      <title>Traefik Ingress Real-Time Access Logs — Takō Cloud</title>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans flex items-center gap-2">
                <Globe className="size-6 text-primary" />
                <span>Traefik Ingress Access Logs</span>
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                <Radio className="size-3 text-primary animate-pulse" />
                Global Edge Telemetry
              </span>
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
