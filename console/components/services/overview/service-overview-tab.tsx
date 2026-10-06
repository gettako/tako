'use client';

import React from 'react';
import { ResourceMetricsCard } from './resource-metrics-card';
import { QuickInfoCard } from './quick-info-card';
import { RecentDeployCard } from './recent-deploy-card';
import { Service, Deployment } from '@/lib/types';

export interface ServiceOverviewTabProps {
  service: Service;
  latestDeployment?: Deployment | null;
  onNavigateTab?: (tabId: string) => void;
}

export function ServiceOverviewTab({
  service,
  latestDeployment,
  onNavigateTab,
}: ServiceOverviewTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 columns: Resource usage */}
        <div className="lg:col-span-2 space-y-6">
          <ResourceMetricsCard service={service} />
        </div>

        {/* Right column: Quick info & active release */}
        <div className="space-y-6">
          <RecentDeployCard
            service={service}
            latestDeployment={latestDeployment}
            onViewAllDeployments={() => onNavigateTab?.('deployments')}
          />
          <QuickInfoCard service={service} />
        </div>
      </div>
    </div>
  );
}
