'use client';

import React, { useState } from 'react';
import { ResourceChart } from '@/components/dashboard/resource-chart';
import { MetricPoint } from '@/lib/queries';
import { Activity, Cpu, Network, HardDrive, Layers } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';

export type NodeTimeRange = '1h' | '6h' | '24h' | '7d';

interface NodeMetricsChartsProps {
  metrics: MetricPoint[];
  nodeName: string;
  timeRange?: NodeTimeRange;
  onTimeRangeChange?: (range: NodeTimeRange) => void;
}

export function NodeMetricsCharts({
  metrics,
  nodeName,
  timeRange = '1h',
  onTimeRangeChange,
}: NodeMetricsChartsProps) {
  const latest = metrics[metrics.length - 1] || {
    cpu: 0,
    memory: 0,
    networkRx: 0,
    networkTx: 0,
    disk: 0,
  };

  const timeRangeLabel =
    timeRange === '1h'
      ? 'the last hour'
      : timeRange === '6h'
      ? 'the last 6 hours'
      : timeRange === '24h'
      ? 'the last 24 hours'
      : 'the last 7 days';

  return (
    <div className="space-y-4">
      {/* Section Header with squircle icon and time range selector */}
      <SectionHeader
        icon={Activity}
        title="Host Telemetry & Metrics"
        description={`Real-time resource utilization for ${nodeName} (sampled over ${timeRangeLabel})`}
        action={
          onTimeRangeChange ? (
            <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border bg-muted/20">
              {(['1h', '6h', '24h', '7d'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => onTimeRangeChange(range)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all active:not-aria-[haspopup]:translate-y-px ${
                    timeRange === range
                      ? 'bg-background text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          ) : null
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CPU Utilization Chart (var(--chart-cpu)) */}
        <ResourceChart
          title="CPU Utilization"
          subtitle="Host processor activity & thread load"
          data={metrics}
          dataKey="cpu"
          colorVar="var(--chart-cpu)"
          unit="%"
          currentValue={latest.cpu}
          icon={Cpu}
        />

        {/* RAM Memory Usage (var(--chart-ram)) */}
        <ResourceChart
          title="RAM Memory Usage"
          subtitle="Physical host memory allocation"
          data={metrics}
          dataKey="memory"
          colorVar="var(--chart-ram)"
          unit="%"
          currentValue={latest.memory}
          icon={Layers}
        />

        {/* Disk Storage & Throughput (var(--chart-disk)) */}
        <ResourceChart
          title="Disk Storage & I/O"
          subtitle="Block storage volume throughput"
          data={metrics}
          dataKey="disk"
          colorVar="var(--chart-disk)"
          unit="%"
          currentValue={latest.disk}
          icon={HardDrive}
        />

        {/* Network Ingress Rx (var(--chart-network)) */}
        <ResourceChart
          title="Network Ingress (Rx)"
          subtitle="Inbound Ethernet interface bandwidth"
          data={metrics}
          dataKey="networkRx"
          colorVar="var(--chart-network)"
          unit="KB/s"
          currentValue={latest.networkRx}
          icon={Network}
        />
      </div>
    </div>
  );
}
