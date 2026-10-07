'use client';

import React from 'react';
import { StepBadge } from './step-badge';
import { Deployment, DeploymentStepName } from '@/lib/types';

export interface StepBadgeBarProps {
  deployment: Deployment;
  activeStepName?: DeploymentStepName;
  onSelectStep?: (stepName: DeploymentStepName) => void;
}

const allStepNames: DeploymentStepName[] = [
  'Queued',
  'Clone',
  'Build',
  'Push/Load image',
  'Deploy',
  'Health check',
  'Live',
];

export function StepBadgeBar({
  deployment,
  activeStepName,
  onSelectStep,
}: StepBadgeBarProps) {
  const isDeploymentFinished = deployment.status === 'live';
  const isDeploymentFailed = deployment.status === 'failed';

  const liveActiveIdx = activeStepName ? allStepNames.indexOf(activeStepName) : -1;
  const runningStepIdx = Math.max(
    -1,
    ...deployment.steps.map((s) => (s.status === 'running' ? allStepNames.indexOf(s.name) : -1))
  );
  const highestRecordedIdx = Math.max(
    -1,
    ...deployment.steps.map((s) => allStepNames.indexOf(s.name))
  );

  const effectiveActiveIdx =
    liveActiveIdx > -1
      ? liveActiveIdx
      : runningStepIdx > -1
      ? runningStepIdx
      : highestRecordedIdx;

  // Ensure all 7 steps are represented
  const fullSteps = allStepNames.map((name, idx) => {
    const existing = deployment.steps.find((s) => s.name === name);
    let status = existing?.status || 'pending';

    if (isDeploymentFinished) {
      status = status === 'failed' ? 'failed' : 'success';
    } else if (isDeploymentFailed) {
      if (existing?.status === 'failed') {
        status = 'failed';
      } else if (idx < effectiveActiveIdx) {
        status = 'success';
      } else {
        status = 'skipped';
      }
    } else {
      // In progress
      if (idx < effectiveActiveIdx) {
        status = existing?.status === 'failed' ? 'failed' : 'success';
      } else if (idx === effectiveActiveIdx) {
        if (name === 'Live') {
          status = 'success';
        } else {
          status = existing?.status === 'failed' ? 'failed' : 'running';
        }
      } else {
        status = 'pending';
      }
    }

    return {
      name,
      status,
      durationMs: existing?.durationMs,
      startedAt: existing?.startedAt,
      finishedAt: existing?.finishedAt,
      logs: existing?.logs,
    };
  });

  return (
    <div className="w-full overflow-x-auto py-2 scrollbar-none">
      <div className="grid grid-cols-7 gap-2.5 sm:gap-3 min-w-[640px] w-full">
        {fullSteps.map((step) => (
          <StepBadge
            key={step.name}
            step={step}
            isActive={activeStepName === step.name}
            onClick={() => onSelectStep?.(step.name)}
          />
        ))}
      </div>
    </div>
  );
}
