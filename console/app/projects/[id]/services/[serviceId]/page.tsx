'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ServiceHeader } from '@/components/services/service-header';
import { ServiceTabs } from '@/components/services/service-tabs';
import { ServiceOverviewTab } from '@/components/services/overview/service-overview-tab';
import { ServiceEnvTab } from '@/components/services/env/service-env-tab';
import { RuntimeLogsTab } from '@/components/services/logs/runtime-logs-tab';
import { TerminalTab } from '@/components/services/terminal/terminal-tab';
import { ServiceDomainTab } from '@/components/services/domains/service-domain-tab';
import { ConnectionTab } from '@/components/services/database/connection-tab';
import { BackupsTab } from '@/components/services/database/backups-tab';
import { ServiceDeploymentTab } from '@/components/services/deployments/service-deployment-tab';
import { ServiceSettingsTab } from '@/components/services/settings/service-settings-tab';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { getServiceById, updateServiceStatus, updateService } from '@/lib/api/services';
import { getProjectById } from '@/lib/api/projects';
import { getDeployments, triggerDeployment } from '@/lib/api/deployments';
import { UpdateServiceInput } from '@/lib/types';

export default function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string; serviceId: string }>;
}) {
  const resolvedParams = React.use(params);
  const { id: projectId, serviceId } = resolvedParams;

  const [activeTab, setActiveTab] = useState('overview');

  const {
    data: project,
    isLoading: loadingProject,
  } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectById(projectId),
  });

  const {
    data: service,
    isLoading: loadingService,
    error: errorService,
    refetch: refetchService,
  } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => getServiceById(serviceId),
    refetchInterval: (query) => {
      const s = query.state.data;
      return s?.status === 'deploying' ? 2000 : false;
    },
  });

  const {
    data: deployments = [],
    isLoading: loadingDeployments,
    refetch: refetchDeployments,
  } = useQuery({
    queryKey: ['deployments', serviceId],
    queryFn: () => getDeployments(serviceId),
    enabled: !!service,
    refetchInterval: (query) => {
      const list = query.state.data;
      const isPending = list?.some(
        (d) =>
          d.status === 'building' ||
          d.status === 'queued' ||
          d.status === 'running' ||
          d.status === 'deploying'
      );
      return isPending || service?.status === 'deploying' ? 2000 : false;
    },
  });

  const latestDeployment = deployments[0] || null;

  const handleDeploy = async () => {
    if (!service) return;
    await triggerDeployment(service.id, service.branch || 'main', service.commitHash);
    await updateServiceStatus(service.id, 'deploying');
    refetchService();
    refetchDeployments();
  };

  const handleStart = async () => {
    if (!service) return;
    await updateServiceStatus(service.id, 'healthy', 'start');
    refetchService();
  };

  const handleRestart = async () => {
    if (!service) return;
    await updateServiceStatus(service.id, 'healthy', 'restart');
    refetchService();
  };

  const handleStop = async () => {
    if (!service) return;
    await updateServiceStatus(service.id, 'stopped', 'stop');
    refetchService();
  };

  const handleUpdateService = async (input: UpdateServiceInput) => {
    if (!service) return;
    await updateService(service.id, input);
    refetchService();
  };

  const handleRebuild = async () => {
    if (!service) return;
    await triggerDeployment(service.id, service.branch || 'main', service.commitHash);
    await updateServiceStatus(service.id, 'deploying');
    refetchService();
    refetchDeployments();
  };

  const titleText = service ? `${service.name} — Takō Cloud` : 'Service Details — Takō Cloud';

  if (errorService) {
    return (
      <>
        <title>{titleText}</title>
        <ErrorState
          title="Service not found"
          description={`Could not find service details for ${serviceId}.`}
          retry={() => refetchService()}
        />
      </>
    );
  }

  if (loadingService || !service) {
    return (
      <>
        <title>{titleText}</title>
        <LoadingSkeleton variant="detail" />
      </>
    );
  }

  return (
    <>
      <title>{titleText}</title>
      <div className="space-y-6">
      {/* Persistent Service Header */}
      <ServiceHeader
        service={service}
        projectId={projectId}
        projectName={project?.name || 'Project'}
        onDeploy={handleDeploy}
        onRebuild={handleRebuild}
        onRestart={handleRestart}
        onStop={handleStop}
        onStart={handleStart}
      />

      {/* Dynamic Tabs Navigation Bar */}
      <ServiceTabs
        serviceType={service.type}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === 'overview' && (
          <ServiceOverviewTab
            service={service}
            latestDeployment={latestDeployment}
            deployments={deployments}
            onNavigateTab={setActiveTab}
            onRetryDeploy={handleDeploy}
          />
        )}

        {activeTab === 'env' && (
          <ServiceEnvTab
            service={service}
            onSaved={() => {
              refetchService();
            }}
          />
        )}

        {activeTab === 'logs' && <RuntimeLogsTab service={service} />}

        <TerminalTab
          service={service}
          deployments={deployments}
          isTabActive={activeTab === 'terminal'}
          onNavigateToTerminalTab={() => setActiveTab('terminal')}
        />

        {activeTab === 'domains' && (
          <ServiceDomainTab
            service={service}
            onDomainsUpdated={() => {
              refetchService();
            }}
          />
        )}

        {activeTab === 'connection' && <ConnectionTab service={service} />}

        {activeTab === 'backups' && <BackupsTab service={service} />}

        {activeTab === 'deployments' && (
          <ServiceDeploymentTab
            service={service}
            deployments={deployments}
            onDeploymentsUpdated={() => {
              refetchDeployments();
              refetchService();
            }}
          />
        )}

        {activeTab === 'settings' && (
          <ServiceSettingsTab
            service={service}
            onUpdateService={handleUpdateService}
            onRestartService={handleRestart}
            onStartService={handleStart}
            onRebuildService={handleRebuild}
          />
        )}
      </div>
    </div>
  </>
);
}
