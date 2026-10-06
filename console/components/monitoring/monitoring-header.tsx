'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCw } from 'lucide-react';
import { cn } from 'cn';

export type TimeRange = '1h' | '6h' | '24h' | '7d';

interface MonitoringHeaderProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

const TIME_RANGES: { id: TimeRange; label: string }[] = [
  { id: '1h', label: 'Last 1 Hour' },
  { id: '6h', label: 'Last 6 Hours' },
  { id: '24h', label: 'Last 24 Hours' },
  { id: '7d', label: 'Last 7 Days' },
];

export function MonitoringHeader({
  timeRange,
  onTimeRangeChange,
  onRefresh,
  isRefreshing,
}: MonitoringHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Cluster Telemetry & Monitoring
        </h1>
        <p className="text-base text-muted-foreground mt-1">
          Historical resource metrics, node comparison breakdowns, network bandwidth, and disk I/O.
        </p>
      </div>

      {/* Time Range Selector & Refresh Action (AC-7) */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border/60 bg-card p-1 text-sm">
          {TIME_RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => onTimeRangeChange(r.id)}
              className={cn(
                'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                timeRange === r.id
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-9 text-sm gap-1.5 border-border/60"
        >
          <RotateCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
