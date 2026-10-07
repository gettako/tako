'use client';

import React from 'react';
import { Cpu, HardDrive, Activity, Server, Radio, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { ResourceBar } from '@/components/ui/resource-bar';
import { Service } from '@/lib/types';

export interface ResourceMetricsCardProps {
  service: Service;
  onNavigateTab?: (tabId: string) => void;
}

export function ResourceMetricsCard({ service, onNavigateTab }: ResourceMetricsCardProps) {
  const hasMemoryLimit = (service.limits?.memoryMb || 0) > 0;
  const memoryPercent = hasMemoryLimit
    ? Math.min(100, Math.round((service.usage.memoryUsedMb / service.limits.memoryMb) * 100))
    : 0;

  const hasCpuLimit = (service.limits?.cpuCores || 0) > 0;
  const diskLimit = service.limits?.diskGb || 10;
  const diskUsed = service.usage.diskUsedGb || 1;
  const diskPercent = Math.min(100, Math.round((diskUsed / Math.max(1, diskLimit)) * 100));

  const getLoadBadge = (pct: number) => {
    if (pct >= 90) {
      return (
        <span className="rounded bg-status-danger/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-status-danger border border-status-danger/20">
          High Load
        </span>
      );
    }
    if (pct >= 70) {
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

  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0 pb-4">
        <SectionHeader
          icon={Activity}
          title="Telemetry & Resource Utilization"
          description="Live compute utilization, memory pressure, and persistent storage"
          action={
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="font-mono text-muted-foreground text-[11px]">
                {service.replicas} {service.replicas === 1 ? 'replica' : 'replicas'} online
              </span>
            </div>
          }
        />
      </CardHeader>

      <CardContent className="p-0 space-y-4">
        {/* 3 Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* 1. CPU */}
          <div className="rounded-lg border border-border bg-background p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-xs text-muted-foreground">
                <Cpu className="size-3.5 text-muted-foreground" />
                CPU Compute
              </span>
              {getLoadBadge(service.usage.cpuPercent)}
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground font-sans">
                  {service.usage.cpuPercent}%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                {hasCpuLimit
                  ? `Limit: ${service.limits.cpuCores} ${service.limits.cpuCores === 1 ? 'Core' : 'Cores'}`
                  : 'Shared host compute'}
              </p>
            </div>

            <div className="pt-1">
              <ResourceBar
                value={service.usage.cpuPercent}
                max={100}
                unit="%"
                showPercentage={false}
                size="sm"
              />
            </div>
          </div>

          {/* 2. Memory (RAM) */}
          <div className="rounded-lg border border-border bg-background p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-xs text-muted-foreground">
                <HardDrive className="size-3.5 text-muted-foreground" />
                Memory (RAM)
              </span>
              {hasMemoryLimit ? (
                getLoadBadge(memoryPercent)
              ) : (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border border-border/50">
                  Shared
                </span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground font-sans">
                  {service.usage.memoryUsedMb}
                </span>
                <span className="text-xs text-muted-foreground font-mono">MB</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                {hasMemoryLimit
                  ? `Limit: ${service.limits.memoryMb} MB (${memoryPercent}%)`
                  : 'Shared with host node'}
              </p>
            </div>

            <div className="pt-1">
              <ResourceBar
                value={service.usage.memoryUsedMb}
                max={hasMemoryLimit ? service.limits.memoryMb : Math.max(service.usage.memoryUsedMb, 1024)}
                unit="MB"
                showPercentage={false}
                size="sm"
              />
            </div>
          </div>

          {/* 3. Disk Storage */}
          <div className="rounded-lg border border-border bg-background p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-xs text-muted-foreground">
                <HardDrive className="size-3.5 text-muted-foreground" />
                Persistent Disk
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border border-border/50">
                {diskPercent}%
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground font-sans">
                  {diskUsed}
                </span>
                <span className="text-xs text-muted-foreground font-mono">GB</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                Quota: {diskLimit} GB
              </p>
            </div>

            <div className="pt-1">
              <ResourceBar
                value={diskUsed}
                max={diskLimit}
                unit="GB"
                showPercentage={false}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Telemetry Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Server className="size-3.5 text-muted-foreground" />
            <span className="font-mono text-[11px]">
              Assigned Host: <span className="text-foreground font-medium">{service.nodeName}</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <Radio className="size-3 text-emerald-500" />
              <span>Daemon synced</span>
            </div>

            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('settings')}
                className="text-foreground hover:underline font-medium inline-flex items-center gap-1 text-[11px]"
              >
                <span>Adjust Limits</span>
                <ArrowRight className="size-3" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
