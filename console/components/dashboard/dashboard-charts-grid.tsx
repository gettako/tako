'use client';

import React from 'react';
import { ResourceChart } from './resource-chart';
import { MetricPoint } from '@/lib/api/metrics';
import { Cpu, Activity, Network, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DashboardChartsGridProps {
  metrics: MetricPoint[];
  timeRange?: '1h' | '6h' | '24h' | '7d';
  onTimeRangeChange?: (range: '1h' | '6h' | '24h' | '7d') => void;
}

export function DashboardChartsGrid({
  metrics,
  timeRange = '1h',
  onTimeRangeChange,
}: DashboardChartsGridProps) {
  const latest = metrics[metrics.length - 1] || {
    cpu: 0,
    memory: 0,
    networkRx: 0,
    networkTx: 0,
    disk: 0,
  };

  const timeRangeLabels: Record<string, string> = {
    '1h': 'last 1 hour',
    '6h': 'last 6 hours',
    '24h': 'last 24 hours',
    '7d': 'last 7 days',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Cluster Telemetry
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aggregated utilization across active cluster nodes ({timeRangeLabels[timeRange] || 'last 1 hour'})
          </p>
        </div>

        {onTimeRangeChange && (
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs self-start sm:self-auto">
            {(['1h', '6h', '24h', '7d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onTimeRangeChange(r)}
                className={cn( 'px-2.5 py-1 rounded-md font-mono text-xs transition-colors cursor-pointer', timeRange === r ? 'bg-background text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground' )}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* CPU Chart (Indigo: var(--chart-cpu)) */}
        <ResourceChart
          title="CPU Utilization"
          subtitle="Cluster-wide average compute"
          data={metrics}
          dataKey="cpu"
          colorVar="var(--chart-cpu)"
          unit="%"
          currentValue={latest.cpu}
          icon={Cpu}
        />

        {/* RAM Chart (Emerald: var(--chart-ram)) */}
        <ResourceChart
          title="Memory (RAM) Usage"
          subtitle="Allocated container memory"
          data={metrics}
          dataKey="memory"
          colorVar="var(--chart-ram)"
          unit="%"
          currentValue={latest.memory}
          icon={Activity}
        />

        {/* Network Chart (Blue: var(--chart-network)) */}
        <ResourceChart
          title="Network Ingress"
          subtitle="Realtime throughput rx rate"
          data={metrics}
          dataKey="networkRx"
          colorVar="var(--chart-network)"
          unit="KB/s"
          currentValue={latest.networkRx}
          icon={Network}
        />

        {/* Disk Chart (Amber: var(--chart-disk)) */}
        <ResourceChart
          title="Storage (Disk) I/O"
          subtitle="Persistent volumes capacity"
          data={metrics}
          dataKey="disk"
          colorVar="var(--chart-disk)"
          unit="%"
          currentValue={latest.disk}
          icon={HardDrive}
        />
      </div>
    </div>
  );
}
