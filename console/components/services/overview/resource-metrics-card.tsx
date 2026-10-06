'use client';

import React from 'react';
import { Cpu, HardDrive } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { ResourceBar } from '@/components/ui/resource-bar';
import { Service } from '@/lib/types';

export interface ResourceMetricsCardProps {
  service: Service;
}

export function ResourceMetricsCard({ service }: ResourceMetricsCardProps) {
  const memoryPercent = Math.round(
    (service.usage.memoryUsedMb / service.limits.memoryMb) * 100
  );

  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0 pb-4">
        <SectionHeader
          icon={Cpu}
          title="Resource Allocation & Usage"
          description="Real-time processor and memory limits across replicas"
          action={
            <span className="text-xs text-muted-foreground font-mono">
              {service.replicas} {service.replicas === 1 ? 'replica' : 'replicas'}
            </span>
          }
        />
      </CardHeader>

      <CardContent className="p-0 space-y-6">
        {/* CPU */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <Cpu className="size-3.5 text-muted-foreground" />
              CPU Utilization
            </span>
            <span className="font-mono text-xs text-foreground">
              Limit: {service.limits.cpuCores} {service.limits.cpuCores === 1 ? 'core' : 'cores'}
            </span>
          </div>
          <ResourceBar
            value={service.usage.cpuPercent}
            max={100}
            unit="%"
            showPercentage={true}
          />
        </div>

        {/* Memory */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <HardDrive className="size-3.5 text-muted-foreground" />
              Memory (RAM)
            </span>
            <span className="font-mono text-xs text-foreground">
              {service.usage.memoryUsedMb}MB / {service.limits.memoryMb}MB
            </span>
          </div>
          <ResourceBar
            value={service.usage.memoryUsedMb}
            max={service.limits.memoryMb}
            unit="MB"
            showPercentage={true}
          />
        </div>

        {/* Disk Storage if defined */}
        {service.limits.diskGb && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <HardDrive className="size-3.5 text-muted-foreground" />
                Persistent Storage
              </span>
              <span className="font-mono text-xs text-foreground">
                {service.usage.diskUsedGb || 1}GB / {service.limits.diskGb}GB
              </span>
            </div>
            <ResourceBar
              value={service.usage.diskUsedGb || 1}
              max={service.limits.diskGb}
              unit="GB"
              showPercentage={true}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
