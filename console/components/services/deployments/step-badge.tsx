'use client';

import React from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { DeploymentStep, StepStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export interface StepBadgeProps {
  step: DeploymentStep;
  isActive?: boolean;
  onClick?: () => void;
}

function formatTimestamp(isoStr?: string): string | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  } catch {
    return null;
  }
}

export function StepBadge({ step, isActive = false, onClick }: StepBadgeProps) {
  const durationSec =
    step.durationMs !== undefined && step.durationMs > 0
      ? `${Math.max(1, Math.round(step.durationMs / 1000))}s`
      : null;
  const timeFormatted = formatTimestamp(step.startedAt);

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case 'success':
        return (
          <div className="flex size-3.5 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
            <Check className="size-2.5 stroke-[3]" />
          </div>
        );
      case 'running':
        return <Loader2 className="size-3.5 shrink-0 text-muted-foreground animate-spin" />;
      case 'failed':
        return (
          <div className="flex size-3.5 items-center justify-center rounded-full bg-red-500 text-white shrink-0">
            <X className="size-2.5 stroke-[3]" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      {/* 1. Top: Stage Name */}
      <span
        className="text-xs text-muted-foreground font-normal truncate select-none"
        title={step.name}
      >
        {step.name}
      </span>

      {/* 2. Middle: Neutral Capsule Bar (No background color fills) */}
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={onClick}
              className={cn(
                'flex h-6 sm:h-7 w-full items-center justify-end gap-1.5 rounded-md border border-border bg-background px-2 text-right transition-colors select-none outline-none focus:outline-none',
                step.status === 'pending'
                  ? 'border-border/60 bg-muted/10 opacity-60 cursor-default'
                  : 'cursor-pointer hover:bg-muted/20 hover:border-foreground/30',
                step.status === 'running' && 'border-muted-foreground/60',
                isActive && 'border-primary ring-1 ring-primary'
              )}
            />
          }
        >
          {durationSec && (
            <span className="font-mono text-[11px] text-muted-foreground select-none">
              {durationSec}
            </span>
          )}
          {getStatusIcon(step.status)}
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px] py-1 px-2">
          <span className="font-semibold text-foreground">{step.name}</span>
          <span className="text-muted-foreground capitalize"> — {step.status}</span>
          {durationSec && <span className="font-mono text-muted-foreground"> ({durationSec})</span>}
        </TooltipContent>
      </Tooltip>

      {/* 3. Bottom: Timestamp */}
      <span className="font-mono text-[11px] text-muted-foreground/60 truncate min-h-[16px] select-none">
        {timeFormatted || ''}
      </span>
    </div>
  );
}
