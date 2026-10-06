'use client';

import React from 'react';
import {
  Clock,
  GitBranch,
  Hammer,
  UploadCloud,
  Rocket,
  HeartPulse,
  CheckCircle2,
  XCircle,
  Loader2,
  MinusCircle,
} from 'lucide-react';
import { DeploymentStep, DeploymentStepName, StepStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface StepBadgeProps {
  step: DeploymentStep;
  isActive?: boolean;
  onClick?: () => void;
}

const stepIcons: Record<DeploymentStepName, React.ComponentType<{ className?: string }>> = {
  Queued: Clock,
  Clone: GitBranch,
  Build: Hammer,
  'Push/Load image': UploadCloud,
  Deploy: Rocket,
  'Health check': HeartPulse,
  Live: CheckCircle2,
};

export function StepBadge({ step, isActive = false, onClick }: StepBadgeProps) {
  const StepIcon = stepIcons[step.name] || Clock;

  const getStatusStyles = (status: StepStatus) => {
    switch (status) {
      case 'running':
        return {
          container:
            'bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 border-blue-500/30',
          dot: 'bg-blue-500',
          pulse: true,
        };
      case 'success':
        return {
          container:
            'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-500',
          pulse: false,
        };
      case 'failed':
        return {
          container:
            'bg-red-500/10 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-red-500/30',
          dot: 'bg-red-500',
          pulse: false,
        };
      case 'skipped':
        return {
          container:
            'bg-neutral-500/10 text-neutral-500 dark:bg-neutral-500/15 dark:text-neutral-400 border-neutral-500/30 border-dashed',
          dot: 'bg-neutral-400',
          pulse: false,
        };
      default: // pending
        return {
          container:
            'bg-neutral-500/5 text-neutral-500 dark:bg-neutral-500/10 dark:text-neutral-400 border-border',
          dot: 'bg-neutral-400',
          pulse: false,
        };
    }
  };

  const style = getStatusStyles(step.status);
  const durationSec = step.durationMs ? `${(step.durationMs / 1000).toFixed(1)}s` : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all select-none whitespace-nowrap outline-none focus:outline-none focus-visible:outline-none',
        style.container,
        isActive && 'border-primary ring-1 ring-inset ring-primary shadow-xs'
      )}
    >
      <div className="relative flex size-2 items-center justify-center shrink-0">
        {style.pulse && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500 opacity-75 motion-reduce:hidden" />
        )}
        <span className={cn('relative inline-flex size-1.5 rounded-full', style.dot)} />
      </div>

      <StepIcon className="size-3.5 shrink-0" />
      <span className="font-semibold">{step.name}</span>

      {durationSec && (
        <span className="font-mono text-[10px] opacity-80 pl-0.5">{durationSec}</span>
      )}
    </button>
  );
}
