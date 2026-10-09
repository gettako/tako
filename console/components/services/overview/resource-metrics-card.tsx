'use client';

import React from 'react';
import { Cpu, HardDrive, Server, Radio, ArrowRight, LineChart, Database } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Service } from '@/lib/types';

export interface ResourceMetricsCardProps {
  service: Service;
  onNavigateTab?: (tabId: string) => void;
}

export function ResourceMetricsCard({ service, onNavigateTab }: ResourceMetricsCardProps) {
  const cpuPercent = service.usage?.cpuPercent ?? 0;
  const memoryUsedMb = service.usage?.memoryUsedMb ?? 0;
  const diskUsedGb = service.usage?.diskUsedGb ?? 1;

  const hasMemoryLimit = (service.limits?.memoryMb || 0) > 0;
  const memoryPercent = hasMemoryLimit
    ? Math.min(100, Math.round((memoryUsedMb / service.limits.memoryMb) * 100))
    : 0;

  const hasCpuLimit = (service.limits?.cpuCores || 0) > 0;
  const diskLimit = service.limits?.diskGb || 10;
  const diskPercent = Math.min(100, Math.round((diskUsedGb / Math.max(1, diskLimit)) * 100));

  return (
    <div className="space-y-3">
      {/* 4 Stat Cards Grid (Exactly matches Dashboard Stats Overview) */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. CPU Compute */}
        <StatCard
          title="CPU Compute"
          value={`${cpuPercent}%`}
          subtext={
            hasCpuLimit
              ? `Quota: ${service.limits.cpuCores} ${service.limits.cpuCores === 1 ? 'core' : 'cores'}`
              : 'Shared host compute'
          }
          icon={Cpu}
          statusAccent={
            cpuPercent >= 85
              ? 'unhealthy'
              : cpuPercent >= 65
              ? 'warning'
              : 'healthy'
          }
          change={{
            value:
              cpuPercent >= 85
                ? 'High Load'
                : cpuPercent >= 65
                ? 'Elevated'
                : 'Normal',
            trend: cpuPercent >= 85 ? 'down' : 'up',
          }}
        />

        {/* 2. Memory (RAM) */}
        <StatCard
          title="Memory (RAM)"
          value={`${memoryUsedMb} MB`}
          subtext={
            hasMemoryLimit
              ? `Limit: ${service.limits.memoryMb} MB`
              : 'Shared host memory'
          }
          icon={HardDrive}
          statusAccent={
            memoryPercent >= 85
              ? 'unhealthy'
              : memoryPercent >= 65
              ? 'warning'
              : 'healthy'
          }
          change={
            hasMemoryLimit
              ? {
                  value: `${memoryPercent}% used`,
                  trend: memoryPercent >= 85 ? 'down' : 'up',
                }
              : undefined
          }
        />

        {/* 3. Persistent Disk */}
        <StatCard
          title="Persistent Disk"
          value={`${diskUsedGb} GB`}
          subtext={`Quota: ${diskLimit} GB allocated`}
          icon={Database}
          change={{
            value: `${diskPercent}% quota`,
            trend: 'neutral',
          }}
        />

        {/* 4. Container Replicas */}
        <StatCard
          title="Container Replicas"
          value={`${service.replicas} ${service.replicas === 1 ? 'Instance' : 'Instances'}`}
          subtext={`Host: ${service.nodeName}`}
          icon={Server}
          statusAccent={
            service.status === 'healthy'
              ? 'healthy'
              : service.status === 'stopped'
              ? 'neutral'
              : 'warning'
          }
          change={{
            value:
              service.status === 'healthy'
                ? 'Online'
                : service.status === 'stopped'
                ? 'Stopped'
                : 'Deploying',
            trend: service.status === 'healthy' ? 'up' : 'neutral',
          }}
        />
      </div>

      {/* Sub-bar with host daemon status & quick navigation links */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-muted-foreground font-mono text-[11px]">
        <div className="flex items-center gap-1.5">
          <Radio className="size-3 text-emerald-500" />
          <span>Daemon synced with {service.nodeName}</span>
        </div>

        {onNavigateTab && (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigateTab('metrics')}
              className="text-foreground hover:underline font-medium inline-flex items-center gap-1 text-[11px]"
            >
              <LineChart className="size-3 text-primary" />
              <span>Open Detailed Metrics</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              className="text-foreground hover:underline font-medium inline-flex items-center gap-1 text-[11px]"
            >
              <span>Adjust Limits</span>
              <ArrowRight className="size-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
