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
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
            Cluster Monitoring
          </h1>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-status-success/30 bg-status-success/10 px-2.5 py-0.5 text-xs font-medium text-status-success">
            <span className="size-1.5 rounded-full bg-status-success animate-pulse" />
            Live Telemetry Active
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          Historical resource metrics, multi-node comparisons, network bandwidth, and storage I/O.
        </p>
      </div>

      {/* Time Range Selector & Refresh Action */}
      <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-auto">
        <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs">
          {TIME_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onTimeRangeChange(r.id)}
              className={cn( 'px-2.5 py-1 rounded-md text-xs font-medium transition-all active:not-aria-[haspopup]:translate-y-px', timeRange === r.id ? 'bg-primary text-primary-foreground font-semibold ' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60' )}
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
          className="gap-1.5 text-xs sm:text-sm h-9 px-3 active:not-aria-[haspopup]:translate-y-px cursor-pointer"
        >
          <RotateCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </Button>
      </div>
    </div>
  );
}
