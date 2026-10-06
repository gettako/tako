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
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-primary/5 via-background to-background p-6 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
              Cluster Telemetry & Monitoring
            </h1>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-success/25 bg-status-success/15 px-2.5 py-0.5 text-xs font-medium text-status-success">
              <span className="size-1.5 rounded-full bg-status-success animate-pulse" />
              Live Telemetry Active
            </span>
          </div>

          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
            Historical resource metrics, multi-node comparison breakdowns, network bandwidth, and persistent storage throughput.
          </p>
        </div>

        {/* Time Range Selector & Refresh Action */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-1 text-xs">
            {TIME_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onTimeRangeChange(r.id)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-all active:not-aria-[haspopup]:translate-y-px',
                  timeRange === r.id
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
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
            className="h-9 text-xs gap-1.5 border-border/70 bg-card active:not-aria-[haspopup]:translate-y-px shadow-2xs"
          >
            <RotateCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
