'use client';

import React from 'react';
import { ResourceMetricsCard } from './resource-metrics-card';
import { QuickInfoCard } from './quick-info-card';
import { RecentDeployCard } from './recent-deploy-card';
import { NetworkEndpointsCard } from './network-endpoints-card';
import { Service, Deployment } from '@/lib/types';

export interface ServiceOverviewTabProps {
  service: Service;
  latestDeployment?: Deployment | null;
  deployments?: Deployment[];
  onNavigateTab?: (tabId: string) => void;
}

export function ServiceOverviewTab({
  service,
  latestDeployment,
  deployments,
  onNavigateTab,
}: ServiceOverviewTabProps) {
  const activeDeployment = latestDeployment || deployments?.[0] || null;

  return (
    <div className="space-y-6">
      {/* 1. Hero: Active Release & Deployment Pipeline Card */}
      <RecentDeployCard
        service={service}
        latestDeployment={activeDeployment}
        onViewAllDeployments={() => onNavigateTab?.('deployments')}
        onNavigateTab={onNavigateTab}
      />

      {/* 2. Live Telemetry & Resource Utilization (CPU, RAM, Disk, Replicas) */}
      <ResourceMetricsCard service={service} />

      {/* 3. Networking Endpoints & Runtime Configuration Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <NetworkEndpointsCard
          service={service}
          latestDeployment={activeDeployment}
          onManageDomains={() => onNavigateTab?.('domains')}
        />
        <QuickInfoCard
          service={service}
          onNavigateTab={onNavigateTab}
        />
      </div>
    </div>
  );
}
