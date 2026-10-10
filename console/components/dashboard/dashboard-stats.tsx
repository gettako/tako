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
        subtext={totalServices === 0 ? 'No workloads provisioned' : `${healthyServices} running healthy`}
        icon={Layers}
        statusAccent={totalServices === 0 || healthyServices === totalServices ? undefined : 'warning'}
        change={{
          value: totalServices === 0 ? '0 Workloads' : `${Math.round((healthyServices / totalServices) * 100)}% Healthy`,
          trend: totalServices === 0 ? 'neutral' : healthyServices === totalServices ? 'up' : 'down',
        }}
      />
      <StatCard
        title="Cluster Nodes"
        value={totalNodes === 0 ? '0' : `${onlineNodes}/${totalNodes}`}
        subtext={
          totalNodes === 0
            ? 'No hosts registered'
            : totalNodes - onlineNodes > 0
            ? `${totalNodes - onlineNodes} ${totalNodes - onlineNodes === 1 ? 'node' : 'nodes'} offline`
            : 'All nodes online'
        }
        icon={Server}
        statusAccent={totalNodes === 0 || totalNodes - onlineNodes === 0 ? undefined : 'warning'}
        change={{
          value:
            totalNodes === 0
              ? 'No Nodes'
              : totalNodes - onlineNodes > 0
              ? `${totalNodes - onlineNodes} Degraded`
              : '100% Online',
          trend: totalNodes === 0 ? 'neutral' : totalNodes - onlineNodes > 0 ? 'down' : 'up',
        }}
      />
      <StatCard
        title="Attention Needed"
        value={degradedOrUnhealthy}
        subtext={
          totalServices === 0
            ? 'No workloads to monitor'
            : degradedOrUnhealthy === 0
            ? 'No degraded workloads'
            : `${degradedOrUnhealthy} ${degradedOrUnhealthy === 1 ? 'workload' : 'workloads'} impaired`
        }
        icon={AlertCircle}
        statusAccent={degradedOrUnhealthy === 0 ? undefined : 'unhealthy'}
        change={{
          value: degradedOrUnhealthy === 0 ? 'Healthy' : 'Investigate',
          trend: degradedOrUnhealthy === 0 ? 'up' : 'down',
        }}
      />
    </div>
  );
}
