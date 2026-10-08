'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Cpu,
  HardDrive,
  Network,
  Activity,
  RefreshCw,
  Server,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Play,
  Settings,
  Layers,
  ScrollText,
  Database,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ResourceBar } from '@/components/ui/resource-bar';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Service } from '@/lib/types';
import {
  getServiceTimeSeriesMetrics,
  ServiceMetricPoint,
  TimeRange,
} from '@/lib/api/metrics';
import { cn } from '@/lib/utils';

export interface ServiceMetricsTabProps {
  service: Service;
  onNavigateTab?: (tabId: string) => void;
  onStartService?: () => void;
}

const TIME_RANGES: { id: TimeRange; label: string }[] = [
  { id: '15m', label: '15m' },
  { id: '1h', label: '1h' },
  { id: '6h', label: '6h' },
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
];

const REFRESH_INTERVALS = [
  { label: 'Off', value: 0 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
];

export function ServiceMetricsTab({
  service,
  onNavigateTab,
  onStartService,
}: ServiceMetricsTabProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [refreshInterval, setRefreshInterval] = useState<number>(10000);
  const [selectedReplica, setSelectedReplica] = useState<string>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isServiceStopped = service.status === 'stopped';

  // Fetch real-time telemetry metrics for the service
  const {
    data: rawMetrics = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['service-metrics', service.id, timeRange],
    queryFn: () =>
      getServiceTimeSeriesMetrics(service.id, timeRange, {
        cpuPercent: service.usage?.cpuPercent,
        memoryUsedMb: service.usage?.memoryUsedMb,
        memoryLimitMb: service.limits?.memoryMb || 1024,
        replicas: service.replicas,
      }),
    refetchInterval: isServiceStopped ? false : refreshInterval > 0 ? refreshInterval : false,
  });

  const memoryLimitMb = service.limits?.memoryMb || 1024;
  const cpuLimitCores = service.limits?.cpuCores || 1;
  const diskLimitGb = service.limits?.diskGb || 10;
  const diskUsedGb = service.usage?.diskUsedGb || 1;

  // Process metrics based on replica selection if multi-instance
  const processedMetrics = useMemo(() => {
    if (!rawMetrics.length) return [];

    return rawMetrics.map((point) => {
      let cpu = point.cpu;
      let memory = point.memory;

      if (selectedReplica !== 'all' && point.replicaMetrics?.[selectedReplica]) {
        cpu = point.replicaMetrics[selectedReplica].cpu;
        memory = point.replicaMetrics[selectedReplica].memory;
      }

      const memPct = Math.min(100, Math.round((memory / Math.max(1, memoryLimitMb)) * 100));

      return {
        ...point,
        displayCpu: isServiceStopped ? 0 : cpu,
        displayMemory: isServiceStopped ? 0 : memory,
        displayMemoryPercent: isServiceStopped ? 0 : memPct,
        displayRx: isServiceStopped ? 0 : point.networkRx,
        displayTx: isServiceStopped ? 0 : point.networkTx,
        displayDiskRead: isServiceStopped ? 0 : point.diskRead,
        displayDiskWrite: isServiceStopped ? 0 : point.diskWrite,
        time: new Date(point.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    });
  }, [rawMetrics, selectedReplica, memoryLimitMb, isServiceStopped]);

  // Aggregate stats across time window
  const summaryStats = useMemo(() => {
    if (!processedMetrics.length) {
      return {
        currentCpu: isServiceStopped ? 0 : (service.usage?.cpuPercent || 0),
        avgCpu: 0,
        peakCpu: 0,
        currentMem: isServiceStopped ? 0 : (service.usage?.memoryUsedMb || 0),
        avgMem: 0,
        peakMem: 0,
        currentRx: 0,
        currentTx: 0,
        peakRx: 0,
        peakTx: 0,
        currentDiskRead: 0,
        currentDiskWrite: 0,
      };
    }

    const latest = processedMetrics[processedMetrics.length - 1];
    let totalCpu = 0;
    let peakCpu = 0;
    let totalMem = 0;
    let peakMem = 0;
    let peakRx = 0;
    let peakTx = 0;

    processedMetrics.forEach((m) => {
      totalCpu += m.displayCpu;
      if (m.displayCpu > peakCpu) peakCpu = m.displayCpu;
      totalMem += m.displayMemory;
      if (m.displayMemory > peakMem) peakMem = m.displayMemory;
      if (m.displayRx > peakRx) peakRx = m.displayRx;
      if (m.displayTx > peakTx) peakTx = m.displayTx;
    });

    const len = processedMetrics.length;

    return {
      currentCpu: latest.displayCpu,
      avgCpu: Math.round(totalCpu / len),
      peakCpu,
      currentMem: latest.displayMemory,
      avgMem: Math.round(totalMem / len),
      peakMem,
      currentRx: latest.displayRx,
      currentTx: latest.displayTx,
      peakRx,
      peakTx,
      currentDiskRead: latest.displayDiskRead,
      currentDiskWrite: latest.displayDiskWrite,
    };
  }, [processedMetrics, isServiceStopped, service.usage]);

  const currentMemPercent = Math.min(
    100,
    Math.round((summaryStats.currentMem / Math.max(1, memoryLimitMb)) * 100)
  );

  const isMemoryPressureHigh = currentMemPercent >= 85;
  const isCpuPressureHigh = summaryStats.currentCpu >= 85;

  const getLoadBadge = (pct: number) => {
    if (pct >= 85) {
      return (
        <span className="rounded bg-status-danger/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-status-danger border border-status-danger/20">
          High Load
        </span>
      );
    }
    if (pct >= 65) {
      return (
        <span className="rounded bg-status-warning/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-status-warning border border-status-warning/20">
          Elevated
        </span>
      );
    }
    return (
      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border border-border/50">
        Normal
      </span>
    );
  };

  const chartConfigs = {
    cpu: {
      displayCpu: {
        label: 'CPU Usage',
        color: 'var(--chart-cpu)',
      },
    },
    memory: {
      displayMemory: {
        label: 'Memory Used',
        color: 'var(--chart-ram)',
      },
    },
    network: {
      displayRx: {
        label: 'Inbound (Rx)',
        color: 'var(--chart-network)',
      },
      displayTx: {
        label: 'Outbound (Tx)',
        color: 'var(--chart-cpu)',
      },
    },
    disk: {
      displayDiskRead: {
        label: 'Disk Read',
        color: 'var(--chart-disk)',
      },
      displayDiskWrite: {
        label: 'Disk Write',
        color: 'var(--chart-ram)',
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar (Time Range, Auto-Refresh, Replicas Filter, Refresh Button) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">
            Time Window:
          </span>
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
            {TIME_RANGES.map((range) => {
              const active = timeRange === range.id;
              return (
                <button
                  key={range.id}
                  type="button"
                  onClick={() => setTimeRange(range.id)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors active:not-aria-[haspopup]:translate-y-px',
                    active
                      ? 'bg-background text-foreground border border-border/80 shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  )}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Multi-Replica filter dropdown if replicas > 1 */}
          {service.replicas > 1 && (
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-muted-foreground">Scope:</span>
              <select
                value={selectedReplica}
                onChange={(e) => setSelectedReplica(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs font-mono text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-hidden"
              >
                <option value="all">Aggregated (All Replicas)</option>
                {Array.from({ length: service.replicas }).map((_, idx) => (
                  <option key={idx} value={`replica-${idx + 1}`}>
                    Replica #{idx + 1}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Auto-Refresh cadence picker */}
          <div className="flex items-center gap-1 text-xs font-mono">
            <span className="text-muted-foreground hidden sm:inline">Refresh:</span>
            <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/20">
              {REFRESH_INTERVALS.map((int) => {
                const active = refreshInterval === int.value;
                return (
                  <button
                    key={int.label}
                    type="button"
                    onClick={() => setRefreshInterval(int.value)}
                    className={cn(
                      'px-2 py-0.5 text-[11px] font-mono rounded transition-colors active:not-aria-[haspopup]:translate-y-px',
                      active
                        ? 'bg-background text-foreground border border-border/80 font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {int.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live pulsing dot indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/60 bg-muted/30 text-[11px] font-mono text-muted-foreground">
            <span className="relative flex size-2">
              {!isServiceStopped && refreshInterval > 0 && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={cn(
                  'relative inline-flex size-2 rounded-full',
                  isServiceStopped
                    ? 'bg-neutral-400'
                    : refreshInterval > 0
                    ? 'bg-emerald-500'
                    : 'bg-amber-400'
                )}
              />
            </span>
            <span>{isServiceStopped ? 'Stopped' : refreshInterval > 0 ? 'Live Telemetry' : 'Paused'}</span>
          </div>

          {/* Manual Refetch Button */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-muted active:not-aria-[haspopup]:translate-y-px transition-colors disabled:opacity-50"
            title="Refresh metrics immediately"
          >
            <RefreshCw
              className={cn('size-3 text-muted-foreground', (isLoading || isRefetching) && 'animate-spin text-primary')}
            />
            <span className="font-mono text-[11px]">Sync</span>
          </button>
        </div>
      </div>

      {/* 2. Alert Notification if Service is Stopped */}
      {isServiceStopped && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg border border-border bg-background flex items-center justify-center shrink-0">
              <Activity className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Container is stopped</p>
              <p className="text-xs text-muted-foreground">
                Telemetry sampling is paused. Start the service to resume live metric telemetry streaming.
              </p>
            </div>
          </div>
          {onStartService && (
            <button
              type="button"
              onClick={onStartService}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 active:not-aria-[haspopup]:translate-y-px transition-colors shrink-0"
            >
              <Play className="size-3 fill-current" />
              <span>Start Service</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Resource Pressure Recommendation Banner (if CPU or Memory is critical) */}
      {!isServiceStopped && (isMemoryPressureHigh || isCpuPressureHigh) && (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg border border-status-warning/20 bg-status-warning/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="size-4 text-status-warning" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                High resource utilization detected ({isMemoryPressureHigh ? `Memory ${currentMemPercent}%` : `CPU ${summaryStats.currentCpu}%`})
              </p>
              <p className="text-xs text-muted-foreground">
                {isMemoryPressureHigh
                  ? `Memory usage is approaching the container limit (${summaryStats.currentMem} MB / ${memoryLimitMb} MB). Consider increasing memory limits to avoid OOM crashes.`
                  : `CPU compute has exceeded 85%. Scaling replicas or upgrading cores in settings will prevent throttled response times.`}
              </p>
            </div>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-muted active:not-aria-[haspopup]:translate-y-px transition-colors shrink-0"
            >
              <Settings className="size-3 text-muted-foreground" />
              <span>Adjust Limits</span>
            </button>
          )}
        </div>
      )}

      {/* 4. Top Telemetry KPI Cards (Matches Dashboard Stats Overview) */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: CPU Utilization */}
        <StatCard
          title="CPU Utilization"
          value={`${summaryStats.currentCpu}%`}
          subtext={`Avg ${summaryStats.avgCpu}% · Quota ${cpuLimitCores} ${cpuLimitCores === 1 ? 'core' : 'cores'}`}
          icon={Cpu}
          statusAccent={
            summaryStats.currentCpu >= 85
              ? 'unhealthy'
              : summaryStats.currentCpu >= 65
              ? 'warning'
              : 'healthy'
          }
          change={{
            value: `Peak ${summaryStats.peakCpu}%`,
            trend: summaryStats.currentCpu >= 85 ? 'down' : 'up',
          }}
        />

        {/* KPI 2: Memory (RAM) */}
        <StatCard
          title="Memory (RAM)"
          value={`${summaryStats.currentMem} MB`}
          subtext={`Avg ${summaryStats.avgMem} MB · Limit ${memoryLimitMb} MB`}
          icon={HardDrive}
          statusAccent={
            currentMemPercent >= 85
              ? 'unhealthy'
              : currentMemPercent >= 65
              ? 'warning'
              : 'healthy'
          }
          change={{
            value: `${currentMemPercent}% of limit`,
            trend: currentMemPercent >= 85 ? 'down' : 'up',
          }}
        />

        {/* KPI 3: Network Traffic */}
        <StatCard
          title="Network Traffic"
          value={`${summaryStats.currentRx} KB/s`}
          subtext={`Peak Rx ${summaryStats.peakRx} KB/s · Tx ${summaryStats.peakTx} KB/s`}
          icon={Network}
          change={{
            value: `Tx ${summaryStats.currentTx} KB/s`,
            trend: 'neutral',
          }}
        />

        {/* KPI 4: Persistent Disk & Storage */}
        <StatCard
          title="Persistent Storage"
          value={`${diskUsedGb} GB`}
          subtext={`Read ${summaryStats.currentDiskRead} IOPS · Write ${summaryStats.currentDiskWrite} IOPS`}
          icon={Database}
          change={{
            value: `${Math.round((diskUsedGb / Math.max(1, diskLimitGb)) * 100)}% quota`,
            trend: 'neutral',
          }}
        />
      </div>

      {/* 5. Main Telemetry Charts (2x2 Grid: CPU, RAM, Network Bandwidth, Disk I/O) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: CPU Utilization (%) */}
        <Card className="rounded-xl border border-border bg-card">
          <CardHeader>
            <SectionHeader
              icon={Cpu}
              title="CPU Compute Utilization"
              description="Processor workload percentage over the selected time window"
              action={
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full bg-[var(--chart-cpu)]" />
                    Current: <span className="font-semibold text-foreground">{summaryStats.currentCpu}%</span>
                  </span>
                </div>
              }
            />
          </CardHeader>

          <CardContent className="pt-2">
            {!mounted || isLoading ? (
              <div className="h-56 w-full animate-pulse rounded-md bg-muted/40" />
            ) : (
              <ChartContainer config={chartConfigs.cpu} className="h-56 w-full">
                <AreaChart
                  data={processedMetrics}
                  margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fill-service-cpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-cpu)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--chart-cpu)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    strokeOpacity={0.35}
                  />

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

                  <ReferenceLine
                    y={85}
                    stroke="var(--status-warning)"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                  />

                  <ChartTooltip
                    cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                    content={
                      <ChartTooltipContent
                        className="font-mono text-xs"
                        formatter={(val) => [`${val}%`, 'CPU Utilization']}
                      />
                    }
                  />

                  <Area
                    type="monotone"
                    dataKey="displayCpu"
                    stroke="var(--chart-cpu)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    fill="url(#fill-service-cpu)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Memory (RAM) Usage (MB) */}
        <Card className="rounded-xl border border-border bg-card">
          <CardHeader>
            <SectionHeader
              icon={HardDrive}
              title="Memory (RAM) Usage"
              description="Physical memory footprint compared to the allocated quota limit"
              action={
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full bg-[var(--chart-ram)]" />
                    Current: <span className="font-semibold text-foreground">{summaryStats.currentMem} MB</span>
                  </span>
                </div>
              }
            />
          </CardHeader>

          <CardContent className="pt-2">
            {!mounted || isLoading ? (
              <div className="h-56 w-full animate-pulse rounded-md bg-muted/40" />
            ) : (
              <ChartContainer config={chartConfigs.memory} className="h-56 w-full">
                <AreaChart
                  data={processedMetrics}
                  margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fill-service-mem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-ram)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--chart-ram)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    strokeOpacity={0.35}
                  />

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
                    domain={[0, memoryLimitMb]}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    className="text-muted-foreground font-mono"
                  />

                  <ReferenceLine
                    y={memoryLimitMb}
                    stroke="var(--status-danger)"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                    label={{
                      value: `Limit: ${memoryLimitMb}MB`,
                      position: 'insideTopRight',
                      fill: 'var(--muted-foreground)',
                      fontSize: 10,
                      fontFamily: 'monospace',
                    }}
                  />

                  <ChartTooltip
                    cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                    content={
                      <ChartTooltipContent
                        className="font-mono text-xs"
                        formatter={(val, name, item) => [
                          `${val} MB (${item.payload.displayMemoryPercent}%)`,
                          'Memory Usage',
                        ]}
                      />
                    }
                  />

                  <Area
                    type="monotone"
                    dataKey="displayMemory"
                    stroke="var(--chart-ram)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    fill="url(#fill-service-mem)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 3: Network Throughput (Inbound & Outbound) */}
        <Card className="rounded-xl border border-border bg-card">
          <CardHeader>
            <SectionHeader
              icon={Network}
              title="Network Bandwidth Throughput"
              description="Ingress (Rx) incoming traffic and egress (Tx) outbound traffic"
              action={
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="flex items-center gap-1 text-[var(--chart-network)]">
                    <ArrowDownLeft className="size-3" />
                    {summaryStats.currentRx} KB/s
                  </span>
                  <span className="flex items-center gap-1 text-[var(--chart-cpu)]">
                    <ArrowUpRight className="size-3" />
                    {summaryStats.currentTx} KB/s
                  </span>
                </div>
              }
            />
          </CardHeader>

          <CardContent className="pt-2">
            {!mounted || isLoading ? (
              <div className="h-56 w-full animate-pulse rounded-md bg-muted/40" />
            ) : (
              <ChartContainer config={chartConfigs.network} className="h-56 w-full">
                <AreaChart
                  data={processedMetrics}
                  margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fill-service-rx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-network)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--chart-network)" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="fill-service-tx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-cpu)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--chart-cpu)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    strokeOpacity={0.35}
                  />

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
                          name === 'displayRx' ? 'Ingress (Rx)' : 'Egress (Tx)',
                        ]}
                      />
                    }
                  />

                  <Area
                    type="monotone"
                    dataKey="displayRx"
                    stroke="var(--chart-network)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    fill="url(#fill-service-rx)"
                  />
                  <Area
                    type="monotone"
                    dataKey="displayTx"
                    stroke="var(--chart-cpu)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    fill="url(#fill-service-tx)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Chart 4: Storage & Disk I/O */}
        <Card className="rounded-xl border border-border bg-card">
          <CardHeader>
            <SectionHeader
              icon={HardDrive}
              title="Storage I/O Intensity"
              description="Persistent block storage read and write throughput operations"
              action={
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="flex items-center gap-1 text-[var(--chart-disk)]">
                    Read: {summaryStats.currentDiskRead} IOPS
                  </span>
                  <span className="flex items-center gap-1 text-[var(--chart-ram)]">
                    Write: {summaryStats.currentDiskWrite} IOPS
                  </span>
                </div>
              }
            />
          </CardHeader>

          <CardContent className="pt-2">
            {!mounted || isLoading ? (
              <div className="h-56 w-full animate-pulse rounded-md bg-muted/40" />
            ) : (
              <ChartContainer config={chartConfigs.disk} className="h-56 w-full">
                <AreaChart
                  data={processedMetrics}
                  margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fill-service-read" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-disk)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--chart-disk)" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="fill-service-write" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-ram)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--chart-ram)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    strokeOpacity={0.35}
                  />

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
                          name === 'displayDiskRead' ? 'Storage Read' : 'Storage Write',
                        ]}
                      />
                    }
                  />

                  <Area
                    type="monotone"
                    dataKey="displayDiskRead"
                    stroke="var(--chart-disk)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    fill="url(#fill-service-read)"
                  />
                  <Area
                    type="monotone"
                    dataKey="displayDiskWrite"
                    stroke="var(--chart-ram)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    fill="url(#fill-service-write)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 6. Multi-Instance / Container Replicas Telemetry Table */}
      <Card className="rounded-xl border border-border bg-card">
        <CardHeader>
          <SectionHeader
            icon={Layers}
            title="Container Instances & Health Breakdown"
            description="Process load, node distribution, and uptime per container instance"
            action={
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <Server className="size-3.5 text-muted-foreground" />
                <span>Host: {service.nodeName}</span>
              </div>
            }
          />
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-y border-border text-muted-foreground font-medium font-mono text-[11px]">
                <tr>
                  <th className="px-4 py-2.5">Instance / Container</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Host Node</th>
                  <th className="px-4 py-2.5">CPU Load</th>
                  <th className="px-4 py-2.5">Memory (RAM)</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {Array.from({ length: Math.max(1, service.replicas) }).map((_, idx) => {
                  const instanceId = `${service.slug}-${idx + 1}`;
                  const rKey = `replica-${idx + 1}`;
                  const latestPoint = rawMetrics[rawMetrics.length - 1];
                  const rMetrics = latestPoint?.replicaMetrics?.[rKey];
                  const instanceCpu = isServiceStopped
                    ? 0
                    : rMetrics
                    ? rMetrics.cpu
                    : summaryStats.currentCpu;
                  const instanceMem = isServiceStopped
                    ? 0
                    : rMetrics
                    ? rMetrics.memory
                    : summaryStats.currentMem;

                  return (
                    <tr key={idx} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-emerald-500" />
                          <span>tako-app-{instanceId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={isServiceStopped ? 'stopped' : service.status}
                          size="sm"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {service.nodeName}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span className="text-foreground font-medium">{instanceCpu}%</span>
                        <span className="text-muted-foreground text-[10px] ml-1.5">
                          of {cpuLimitCores} core
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span className="text-foreground font-medium">{instanceMem} MB</span>
                        <span className="text-muted-foreground text-[10px] ml-1.5">
                          / {memoryLimitMb} MB
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {onNavigateTab && (
                          <button
                            type="button"
                            onClick={() => onNavigateTab('logs')}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                          >
                            <ScrollText className="size-3" />
                            <span>Logs</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
