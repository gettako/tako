'use client';

import React from 'react';
import { FolderKanban, Layers, Server, AlertCircle } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Project, Service, Node } from '@/lib/types';

export interface DashboardStatsProps {
  projects: Project[];
  services: Service[];
  nodes: Node[];
}

export function DashboardStats({ projects, services, nodes }: DashboardStatsProps) {
  const totalProjects = projects.length;
  const totalServices = services.length;
  const onlineNodes = nodes.filter((n) => n.status === 'online').length;
  const totalNodes = nodes.length;

  const healthyServices = services.filter((s) => s.status === 'healthy').length;
  const degradedOrUnhealthy = services.filter(
    (s) => s.status === 'unhealthy' || s.status === 'degraded'
  ).length;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Projects"
        value={totalProjects}
        subtext="Active in cluster"
        icon={FolderKanban}
      />
      <StatCard
        title="Total Services"
        value={totalServices}
        subtext={`${healthyServices} running healthy`}
        icon={Layers}
        statusAccent={healthyServices === totalServices && totalServices > 0 ? 'healthy' : totalServices > 0 ? 'warning' : undefined}
        change={{
          value: `${Math.round((healthyServices / (totalServices || 1)) * 100)}% Healthy`,
          trend: healthyServices === totalServices ? 'up' : 'down',
        }}
      />
      <StatCard
        title="Cluster Nodes"
        value={`${onlineNodes}/${totalNodes}`}
        subtext={totalNodes - onlineNodes > 0 ? `${totalNodes - onlineNodes} ${totalNodes - onlineNodes === 1 ? 'node' : 'nodes'} offline` : 'All nodes online'}
        icon={Server}
        statusAccent={totalNodes - onlineNodes > 0 ? 'warning' : 'healthy'}
        change={{
          value: totalNodes - onlineNodes > 0 ? `${totalNodes - onlineNodes} Degraded` : '100% Online',
          trend: totalNodes - onlineNodes > 0 ? 'down' : 'up',
        }}
      />
      <StatCard
        title="Attention Needed"
        value={degradedOrUnhealthy}
        subtext={
          degradedOrUnhealthy === 0
            ? 'No degraded workloads'
            : `${degradedOrUnhealthy} ${degradedOrUnhealthy === 1 ? 'workload' : 'workloads'} impaired`
        }
        icon={AlertCircle}
        statusAccent={degradedOrUnhealthy === 0 ? 'healthy' : 'unhealthy'}
        change={{
          value: degradedOrUnhealthy === 0 ? 'Healthy' : 'Investigate',
          trend: degradedOrUnhealthy === 0 ? 'up' : 'down',
        }}
      />
    </div>
  );
}
