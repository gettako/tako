'use client';

import React, { useState, useMemo } from 'react';
import { RefreshCw, Play, Pause, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { LogViewer, LogLine } from '@/components/ui/log-viewer';
import { Service } from '@/lib/types';

export interface RuntimeLogsTabProps {
  service: Service;
}

export function RuntimeLogsTab({ service }: RuntimeLogsTabProps) {
  const [isPaused, setIsPaused] = useState(false);

  // Generate realistic runtime logs based on service type
  const initialLogs: LogLine[] = useMemo(() => {
    const now = Date.now();
    const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString().split('T')[1].slice(0, 8);

    if (service.type === 'database') {
      return [
        { id: 1, timestamp: iso(3600000), level: 'info', message: 'PostgreSQL Database directory appears to contain a database; Skipping initialization' },
        { id: 2, timestamp: iso(3590000), level: 'info', message: '2026-10-05 04:00:01 UTC [1] LOG: starting PostgreSQL 16.4 on x86_64-pc-linux-gnu' },
        { id: 3, timestamp: iso(3580000), level: 'info', message: '2026-10-05 04:00:02 UTC [1] LOG: listening on IPv4 address "0.0.0.0", port 5432' },
        { id: 4, timestamp: iso(3570000), level: 'info', message: '2026-10-05 04:00:02 UTC [1] LOG: listening on Unix socket "/var/run/postgresql/.s.PGSQL.5432"' },
        { id: 5, timestamp: iso(3500000), level: 'info', message: '2026-10-05 04:00:03 UTC [28] LOG: database system was shut down at 2026-10-05 03:59:58 UTC' },
        { id: 6, timestamp: iso(3400000), level: 'info', message: '2026-10-05 04:00:03 UTC [1] LOG: database system is ready to accept connections' },
        { id: 7, timestamp: iso(1800000), level: 'info', message: '2026-10-05 04:30:00 UTC [104] LOG: checkpoint starting: time' },
        { id: 8, timestamp: iso(1780000), level: 'info', message: '2026-10-05 04:30:20 UTC [104] LOG: checkpoint complete: wrote 42 buffers (0.3%); 0 WAL file(s) added' },
        { id: 9, timestamp: iso(600000), level: 'info', message: '2026-10-05 04:50:12 UTC [215] LOG: connection received: host=192.168.1.10 port=51234' },
        { id: 10, timestamp: iso(590000), level: 'info', message: '2026-10-05 04:50:12 UTC [215] LOG: connection authorized: user=tako_admin database=production_db' },
      ];
    }

    return [
      { id: 1, timestamp: iso(1200000), level: 'info', message: `[tako-supervisor] Starting container tako-${service.slug}-1` },
      { id: 2, timestamp: iso(1190000), level: 'info', message: 'NODE_ENV=production PORT=3000' },
      { id: 3, timestamp: iso(1180000), level: 'info', message: '▲ Next.js 16.3.8 - Local: http://localhost:3000' },
      { id: 4, timestamp: iso(1170000), level: 'info', message: '✓ Ready in 1.4s' },
      { id: 5, timestamp: iso(900000), level: 'info', message: 'GET / 200 in 42ms' },
      { id: 6, timestamp: iso(850000), level: 'info', message: 'GET /api/health 200 in 4ms' },
      { id: 7, timestamp: iso(620000), level: 'info', message: 'POST /api/v1/checkout 201 in 184ms' },
      { id: 8, timestamp: iso(300000), level: 'warn', message: 'Memory consumption reached 78% of container quota' },
      { id: 9, timestamp: iso(120000), level: 'info', message: 'GET /api/health 200 in 2ms' },
      { id: 10, timestamp: iso(30000), level: 'info', message: 'GET /products/item-8492 200 in 34ms' },
    ];
  }, [service]);

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Terminal}
        title="Runtime Container Logs"
        description="Streaming stdout and stderr from container instances"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="gap-1.5 text-xs h-8"
          >
            {isPaused ? <Play className="size-3.5 text-emerald-500" /> : <Pause className="size-3.5 text-amber-500" />}
            <span>{isPaused ? 'Resume Stream' : 'Pause Stream'}</span>
          </Button>
        }
      />

      <LogViewer
        logs={initialLogs}
        maxHeight={520}
        showTimestamps={true}
        showLineNumbers={true}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused(!isPaused)}
        title={`Container stdout/stderr: tako-${service.slug}`}
      />
    </div>
  );
}
