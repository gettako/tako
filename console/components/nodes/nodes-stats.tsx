'use client';

import React from 'react';
import { Node } from '@/lib/types';
import { StatCard } from '@/components/ui/stat-card';
import { Server, Cpu, Layers, HardDrive } from 'lucide-react';

interface NodesStatsProps {
  nodes: Node[];
}

export function NodesStats({ nodes }: NodesStatsProps) {
  const totalNodes = nodes.length;
  const onlineNodes = nodes.filter((n) => n.status === 'online').length;
  const offlineNodes = nodes.filter((n) => n.status === 'offline').length;
  const degradedNodes = nodes.filter((n) => n.status === 'degraded').length;

  const totalCores = nodes.reduce((acc, n) => acc + n.cpuTotalCores, 0);
  const totalMemoryMb = nodes.reduce((acc, n) => acc + n.memoryTotalMb, 0);
  const totalDiskGb = nodes.reduce((acc, n) => acc + n.diskTotalGb, 0);

  const formattedMemory = `${Math.round(totalMemoryMb / 1024)} GB`;
  const formattedDisk =
    totalDiskGb >= 1000
      ? `${(totalDiskGb / 1000).toFixed(1)} TB`
      : `${totalDiskGb} GB`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Cluster Nodes"
        value={`${onlineNodes}/${totalNodes}`}
        subtext={
          offlineNodes > 0
            ? `${offlineNodes} offline, ${degradedNodes} degraded`
            : degradedNodes > 0
            ? `${degradedNodes} degraded, ${onlineNodes} online`
            : `${onlineNodes} online and healthy`
        }
        icon={Server}
        statusAccent={offlineNodes > 0 ? 'danger' : degradedNodes > 0 ? 'warning' : 'healthy'}
      />
      <StatCard
        title="Compute Capacity"
        value={`${totalCores} Cores`}
        subtext="Available physical CPU threads"
        icon={Cpu}
      />
      <StatCard
        title="Cluster Memory"
        value={formattedMemory}
        subtext="Total allocated host RAM"
        icon={Layers}
      />
      <StatCard
        title="Persistent Storage"
        value={formattedDisk}
        subtext="Total NVMe & SSD storage"
        icon={HardDrive}
      />
    </div>
  );
}
