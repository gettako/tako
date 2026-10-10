'use client';

import React, { useState, useMemo } from 'react';
import { RefreshCw, Play, Pause, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { LogViewer, LogLine } from '@/components/ui/log-viewer';
import { Service } from '@/lib/types';
import { useServiceContainerLogs } from '@/lib/queries';

export interface RuntimeLogsTabProps {
  service: Service;
}

export function RuntimeLogsTab({ service }: RuntimeLogsTabProps) {
  const [isPaused, setIsPaused] = useState(false);

  const {
    data: rawLogs,
    isLoading,
    isFetching,
    refetch,
  } = useServiceContainerLogs(service.id, undefined, {
    refetchInterval: isPaused ? false : 3500,
  });

  const logs = useMemo<LogLine[]>(() => {
    const rawText = rawLogs || '';
    if (!rawText.trim()) {
      const timeStr = new Date().toTimeString().split(' ')[0];
      return [
        {
          id: 1,
          timestamp: timeStr,
          level: 'info',
          message: `[tako-runtime] Container tako-app-${service.slug} (${service.status}). Waiting for output...`,
        },
      ];
    }

    const lines = rawText.split('\n');
    const parsedLogs: LogLine[] = [];

    lines.forEach((line: string, idx: number) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let level: LogLine['level'] = 'info';
      const lower = trimmed.toLowerCase();
      if (lower.includes('error') || lower.includes('fail') || lower.includes('fatal') || lower.includes('panic')) {
        level = 'error';
      } else if (lower.includes('warn')) {
        level = 'warn';
      }

      // Try extracting timestamp if present at beginning (e.g. 2026-10-07T14:00:00Z)
      let timestamp = new Date().toTimeString().split(' ')[0];
      let message = trimmed;

      const tsMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)\s*(.*)$/);
      if (tsMatch) {
        const dt = new Date(tsMatch[1]);
        if (!isNaN(dt.getTime())) {
          timestamp = dt.toTimeString().split(' ')[0];
        }
        message = tsMatch[3] || trimmed;
      }

      parsedLogs.push({
        id: idx + 1,
        timestamp,
        level,
        message,
      });
    });

    return parsedLogs;
  }, [rawLogs, service.slug, service.status]);

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Terminal}
        title="Runtime Container Logs"
        description="Streaming live stdout and stderr from container instance"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading || isFetching}
              className="gap-1.5 text-xs h-8"
              title="Refresh logs"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
              className="gap-1.5 text-xs h-8"
            >
              {isPaused ? (
                <Play className="size-3.5 text-status-success" />
              ) : (
                <Pause className="size-3.5 text-status-warning" />
              )}
              <span>{isPaused ? 'Resume Stream' : 'Pause Stream'}</span>
            </Button>
          </div>
        }
      />

      <LogViewer
        logs={logs}
        maxHeight={520}
        showTimestamps={true}
        showLineNumbers={true}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused(!isPaused)}
        title={`Container stdout/stderr: tako-app-${service.slug}`}
      />
    </div>
  );
}
