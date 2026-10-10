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
import { ServiceMetricsTab } from '@/components/services/metrics/service-metrics-tab';
import { ServiceSettingsTab } from '@/components/services/settings/service-settings-tab';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
  useProject,
  useService,
  useDeployments,
  useNodes,
  useUpdateServiceStatus,
  useUpdateService,
  useTriggerDeployment,
} from '@/lib/queries';
import { UpdateServiceInput } from '@/lib/types';

export default function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string; serviceId: string }>;
}) {
  const resolvedParams = React.use(params);
  const { id: projectId, serviceId } = resolvedParams;

  const [activeTab, setActiveTab] = useState('overview');

  const { data: project, isLoading: loadingProject } = useProject(projectId);
  const {
    data: service,
    isLoading: loadingService,
    error: errorService,
    refetch: refetchService,
  } = useService(serviceId);

  const {
    data: deployments = [],
    isLoading: loadingDeployments,
    refetch: refetchDeployments,
  } = useDeployments(serviceId, {
    enabled: !!service,
  });

  const { data: nodes = [] } = useNodes();

  const updateStatusMutation = useUpdateServiceStatus();
  const updateServiceMutation = useUpdateService();
  const triggerDeploymentMutation = useTriggerDeployment();

  const latestDeployment = deployments[0] || null;

  const targetNode = nodes.find(
    (n) => n.id === service?.nodeId || n.name === service?.nodeName
  );
  const nodeIp = targetNode?.publicIp || targetNode?.ipAddress;

  const handleDeploy = async () => {
    if (!service) return;
    await triggerDeploymentMutation.mutateAsync({
      serviceId: service.id,
      branch: service.branch || 'main',
      commitHash: service.commitHash,
    });
    await updateStatusMutation.mutateAsync({
      serviceId: service.id,
      status: 'deploying',
    });
  };

  const handleStart = async () => {
    if (!service) return;
    await updateStatusMutation.mutateAsync({
      serviceId: service.id,
      status: 'healthy',
      action: 'start',
    });
  };

  const handleRestart = async () => {
    if (!service) return;
    await updateStatusMutation.mutateAsync({
      serviceId: service.id,
      status: 'healthy',
      action: 'restart',
    });
  };

  const handleStop = async () => {
    if (!service) return;
    await updateStatusMutation.mutateAsync({
      serviceId: service.id,
      status: 'stopped',
      action: 'stop',
    });
  };

  const handleUpdateService = async (input: UpdateServiceInput) => {
    if (!service) return;
    await updateServiceMutation.mutateAsync({
      id: service.id,
      input,
    });
  };

  const handleRebuild = async () => {
    if (!service) return;
    await triggerDeploymentMutation.mutateAsync({
      serviceId: service.id,
      branch: service.branch || 'main',
      commitHash: service.commitHash,
    });
    await updateStatusMutation.mutateAsync({
      serviceId: service.id,
      status: 'deploying',
    });
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
        latestDeployment={latestDeployment}
        nodeIp={nodeIp}
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

        {activeTab === 'metrics' && (
          <ServiceMetricsTab
            service={service}
            onNavigateTab={setActiveTab}
            onStartService={handleStart}
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
            nodeIp={nodeIp}
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
            onStopService={handleStop}
            onRebuildService={handleRebuild}
          />
        )}
      </div>
    </div>
  </>
);
}
