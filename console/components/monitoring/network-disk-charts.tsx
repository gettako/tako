'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartCard,
  ChartCardHeader,
  ChartCardContent,
} from '@/components/ui/chart';
import { MetricPoint } from '@/lib/api/metrics';
import { ArrowDownLeft, ArrowUpRight, HardDrive, Network } from 'lucide-react';

interface NetworkDiskChartsProps {
  metrics: MetricPoint[];
}

export function NetworkDiskCharts({ metrics }: NetworkDiskChartsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const latest = metrics[metrics.length - 1] || {
    networkRx: 0,
    networkTx: 0,
    disk: 0,
  };

  const formattedData = metrics.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    disk: d.disk ?? 0,
  }));

  const networkConfig = {
    networkRx: { label: 'Inbound (Rx)', color: 'var(--chart-network)' },
    networkTx: { label: 'Outbound (Tx)', color: 'var(--chart-cpu)' },
  };

  const diskConfig = {
    disk: { label: 'Storage Used', color: 'var(--chart-disk)' },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Network Traffic (In/Out) Chart */}
      <ChartCard>
        <ChartCardHeader
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

        <ChartCardContent isLoading={!mounted} skeletonHeight="h-56">
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
        </ChartCardContent>
      </ChartCard>

      {/* Persistent Storage Allocation Chart */}
      <ChartCard>
        <ChartCardHeader
          icon={HardDrive}
          title="Persistent Storage Allocation"
          description="Cluster persistent storage volume utilization across cluster members."
          action={
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1 text-[var(--chart-disk)]">
                <HardDrive className="size-3" />
                Capacity Used: {latest.disk}%
              </span>
            </div>
          }
        />

        <ChartCardContent isLoading={!mounted} skeletonHeight="h-56">
          <ChartContainer config={diskConfig} className="h-56 w-full">
            <AreaChart data={formattedData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fill-disk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-disk)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--chart-disk)" stopOpacity={0.0} />
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
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                className="text-muted-foreground font-mono"
              />

              <ChartTooltip
                cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                content={
                  <ChartTooltipContent
                    className="font-mono text-xs"
                    formatter={(val) => [`${val}%`, 'Storage Used']}
                  />
                }
              />

              <Area
                type="monotone"
                dataKey="disk"
                stroke="var(--chart-disk)"
                strokeWidth={2}
                strokeLinecap="round"
                fill="url(#fill-disk)"
              />
            </AreaChart>
          </ChartContainer>
        </ChartCardContent>
      </ChartCard>
    </div>
  );
}
