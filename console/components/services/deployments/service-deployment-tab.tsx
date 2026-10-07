'use client';

import React, { useState } from 'react';
import { Rocket, RefreshCw, Plus, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { DeploymentHistoryTable } from './deployment-history-table';
import { StepBadgeBar } from './step-badge-bar';
import { DeploymentLogViewer } from './deployment-log-viewer';
import { RollbackDialog } from './rollback-dialog';
import { Deployment, DeploymentStepName, Service } from '@/lib/types';
import { rollbackDeployment, triggerDeployment } from '@/lib/api/deployments';

export interface ServiceDeploymentTabProps {
  service: Service;
  deployments: Deployment[];
  onDeploymentsUpdated?: () => void;
}

export function ServiceDeploymentTab({
  service,
  deployments,
  onDeploymentsUpdated,
}: ServiceDeploymentTabProps) {
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(
    deployments[0] || null
  );
  const [activeStep, setActiveStep] = useState<DeploymentStepName | undefined>();
  const [rollbackTarget, setRollbackTarget] = useState<Deployment | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [showLogsManual, setShowLogsManual] = useState(false);

  React.useEffect(() => {
    if (deployments.length > 0) {
      setSelectedDeployment((prev) => {
        if (!prev) return deployments[0];
        const updated = deployments.find((d) => d.id === prev.id);
        return updated || deployments[0];
      });
    }
  }, [deployments]);

  const isDeploying =
    selectedDeployment?.status === 'running' ||
    selectedDeployment?.status === 'queued' ||
    selectedDeployment?.status === 'building' ||
    selectedDeployment?.status === 'deploying' ||
    isTriggering ||
    service.status === 'deploying';

  const handleRollbackConfirm = async (deploymentId: string) => {
    setIsRollingBack(true);
    try {
      const newDep = await rollbackDeployment(deploymentId);
      setSelectedDeployment(newDep);
      setRollbackTarget(null);
      onDeploymentsUpdated?.();
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleManualDeploy = async () => {
    setIsTriggering(true);
    try {
      const newDep = await triggerDeployment(service.id, service.branch || 'main');
      setSelectedDeployment(newDep);
      onDeploymentsUpdated?.();
    } finally {
      setIsTriggering(false);
    }
  };

  const handleSelectStep = (stepName: DeploymentStepName) => {
    setActiveStep(stepName);
    const element = document.getElementById(`log-step-${stepName.replace(/[^a-zA-Z0-9]/g, '-')}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  if (deployments.length === 0) {
    return (
      <EmptyState
        title="No deployments recorded"
        description="This service has not been deployed yet. Trigger the first build pipeline to launch."
        icon={Rocket}
        action={{
          label: isTriggering ? 'Triggering...' : 'Trigger Initial Deploy',
          icon: Plus,
          onClick: handleManualDeploy,
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Row */}
      <SectionHeader
        icon={Rocket}
        title="Deployment History & Pipeline"
        description="Audit build stages, rollback to previous revisions, and view compiler logs"
        action={
          <Button
            size="sm"
            onClick={handleManualDeploy}
            disabled={isTriggering}
            className="gap-1.5 text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Rocket className="size-3.5" />
            <span>{isTriggering ? 'Deploying...' : 'Deploy Now'}</span>
          </Button>
        }
      />

      {/* Selected Deployment Pipeline Detail */}
      {selectedDeployment && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">
                  Inspecting Release:
                </span>
                <span className="font-mono text-xs text-primary font-bold">
                  {selectedDeployment.commitHash.substring(0, 7)}
                </span>
                <span className="text-xs text-muted-foreground">({selectedDeployment.branch})</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                "{selectedDeployment.commitMessage}" by {selectedDeployment.author}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogsManual(!showLogsManual)}
                className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Terminal className="size-3.5" />
                <span>{showLogsManual || isDeploying ? 'Hide Output' : 'View Output'}</span>
              </Button>
              <div className="text-xs font-mono text-muted-foreground">
                Started {new Date(selectedDeployment.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* 7-Step Pipeline Progress Bar */}
          <StepBadgeBar
            deployment={selectedDeployment}
            activeStepName={activeStep}
            onSelectStep={handleSelectStep}
          />

          {/* Live Virtualized Log Output - Only shows when deploying or manually toggled */}
          {(isDeploying || showLogsManual) && (
            <DeploymentLogViewer
              deployment={selectedDeployment}
              serviceName={service.name}
              onLiveStepUpdate={(step) => setActiveStep(step)}
            />
          )}
        </div>
      )}

      {/* Deployment History Table */}
      <div className="pt-2">
        <DeploymentHistoryTable
          deployments={deployments}
          selectedDeploymentId={selectedDeployment?.id}
          onSelectDeployment={(dep) => setSelectedDeployment(dep)}
          onRequestRollback={(dep) => setRollbackTarget(dep)}
        />
      </div>

      {/* Rollback Confirmation Modal */}
      <RollbackDialog
        open={!!rollbackTarget}
        deployment={rollbackTarget}
        onOpenChange={(open) => !open && setRollbackTarget(null)}
        onConfirm={handleRollbackConfirm}
        isRollingBack={isRollingBack}
      />
    </div>
  );
}
