'use client';

import React from 'react';
import { StepBadge } from './step-badge';
import { Deployment, DeploymentStepName } from '@/lib/types';
import { ChevronRight } from 'lucide-react';

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
  // Ensure all 7 steps are represented
  const fullSteps = allStepNames.map((name) => {
    const existing = deployment.steps.find((s) => s.name === name);
    if (existing) return existing;
    return { name, status: 'pending' as const };
  });

  return (
    <div className="w-full overflow-x-auto p-1 pb-2 scrollbar-none">
      <div className="flex items-center gap-2 min-w-max">
        {fullSteps.map((step, idx) => (
          <React.Fragment key={step.name}>
            <StepBadge
              step={step}
              isActive={activeStepName === step.name}
              onClick={() => onSelectStep?.(step.name)}
            />
            {idx < fullSteps.length - 1 && (
              <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
