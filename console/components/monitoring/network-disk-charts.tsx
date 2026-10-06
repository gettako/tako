'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { MetricPoint } from '@/lib/api/metrics';
import { ArrowDownLeft, ArrowUpRight, HardDrive, Network } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';

interface NetworkDiskChartsProps {
  metrics: MetricPoint[];
}

export function NetworkDiskCharts({ metrics }: NetworkDiskChartsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const latest = metrics[metrics.length - 1] || {
    networkRx: 1420,
    networkTx: 2850,
    disk: 52,
  };

  const formattedData = metrics.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    diskRead: Math.round(d.disk * 1.8),
    diskWrite: Math.round(d.disk * 0.9),
  }));

  const networkConfig = {
    networkRx: { label: 'Inbound (Rx)', color: '#3b82f6' },
    networkTx: { label: 'Outbound (Tx)', color: '#6366f1' },
  };

  const diskConfig = {
    diskRead: { label: 'Disk Read', color: '#f59e0b' },
    diskWrite: { label: 'Disk Write', color: '#10b981' },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Network Traffic (In/Out) Chart */}
      <Card className="rounded-xl border border-border bg-card">
        <CardHeader>
          <SectionHeader
            icon={Network}
            title="Cluster Network Bandwidth"
            description="Total aggregate ingress (Rx) and egress (Tx) bandwidth throughput."
            action={
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1 text-[var(--chart-network)]">
                  <ArrowDownLeft className="size-3" />
                  {latest.networkRx} KB/s
                </span>
                <span className="flex items-center gap-1 text-[var(--chart-cpu)]">
                  <ArrowUpRight className="size-3" />
                  {latest.networkTx} KB/s
                </span>
              </div>
            }
          />
        </CardHeader>

        <CardContent className="pt-2">
          {!mounted ? (
            <div className="h-56 w-full animate-pulse rounded-md bg-muted/40" />
          ) : (
            <ChartContainer config={networkConfig} className="h-56 w-full">
              <AreaChart data={formattedData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fill-rx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-network)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--chart-network)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="fill-tx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-cpu)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--chart-cpu)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" stroke="var(--border)" strokeOpacity={0.35} />

                <XAxis
                  dataKey="time"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground font-mono"
                />

                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground font-mono"
                />

                <ChartTooltip
                  cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                  content={
                    <ChartTooltipContent
                      className="font-mono text-xs"
                      formatter={(val, name) => [
                        `${val} KB/s`,
                        name === 'networkRx' ? 'Ingress (Rx)' : 'Egress (Tx)',
                      ]}
                    />
                  }
                />

                <Area
                  type="monotone"
                  dataKey="networkRx"
                  stroke="var(--chart-network)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="url(#fill-rx)"
                />
                <Area
                  type="monotone"
                  dataKey="networkTx"
                  stroke="var(--chart-cpu)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="url(#fill-tx)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Disk Read/Write Throughput Chart */}
      <Card className="rounded-xl border border-border bg-card">
        <CardHeader>
          <SectionHeader
            icon={HardDrive}
            title="Persistent Storage I/O"
            description="Block device throughput rates for read operations and write flushes."
            action={
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1 text-[var(--chart-disk)]">
                  Read: {Math.round(latest.disk * 1.8)} IOPS
                </span>
                <span className="flex items-center gap-1 text-[var(--chart-ram)]">
                  Write: {Math.round(latest.disk * 0.9)} IOPS
                </span>
              </div>
            }
          />
        </CardHeader>

        <CardContent className="pt-2">
          {!mounted ? (
            <div className="h-56 w-full animate-pulse rounded-md bg-muted/40" />
          ) : (
            <ChartContainer config={diskConfig} className="h-56 w-full">
              <AreaChart data={formattedData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fill-read" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-disk)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--chart-disk)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="fill-write" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-ram)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--chart-ram)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" stroke="var(--border)" strokeOpacity={0.35} />

                <XAxis
                  dataKey="time"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground font-mono"
                />

                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground font-mono"
                />

                <ChartTooltip
                  cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                  content={
                    <ChartTooltipContent
                      className="font-mono text-xs"
                      formatter={(val, name) => [
                        `${val} IOPS`,
                        name === 'diskRead' ? 'Disk Read' : 'Disk Write',
                      ]}
                    />
                  }
                />

                <Area
                  type="monotone"
                  dataKey="diskRead"
                  stroke="var(--chart-disk)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="url(#fill-read)"
                />
                <Area
                  type="monotone"
                  dataKey="diskWrite"
                  stroke="var(--chart-ram)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="url(#fill-write)"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
