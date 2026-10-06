'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Status } from '@/lib/types';

const statusAccentColors: Record<string, string> = {
  healthy: 'before:bg-status-success',
  online: 'before:bg-status-success',
  live: 'before:bg-status-success',
  success: 'before:bg-status-success',

  unhealthy: 'before:bg-status-danger',
  offline: 'before:bg-status-danger',
  failed: 'before:bg-status-danger',
  danger: 'before:bg-status-danger',

  deploying: 'before:bg-status-info',
  running: 'before:bg-status-info',
  info: 'before:bg-status-info',

  degraded: 'before:bg-status-warning',
  warning: 'before:bg-status-warning',
  pending: 'before:bg-status-warning',

  stopped: 'before:bg-status-neutral',
  queued: 'before:bg-status-neutral',
  skipped: 'before:bg-status-neutral',
  cancelled: 'before:bg-status-neutral',
  neutral: 'before:bg-status-neutral',
};

export interface StatusAccentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: Status | string;
  hoverable?: boolean;
}

export function StatusAccentCard({
  status = 'healthy',
  hoverable = true,
  className,
  children,
  ...props
}: StatusAccentCardProps) {
  const normalizedStatus = status.toLowerCase();
  const accentClass = statusAccentColors[normalizedStatus] || 'before:bg-neutral-400';

  return (
    <div
      className={cn(
        'relative rounded-xl border border-border bg-card p-4 sm:p-5 text-card-foreground shadow-xs overflow-hidden',
        'before:absolute before:inset-y-0 before:left-0 before:w-[3px]',
        accentClass,
        hoverable && 'transition-all duration-150 hover:border-border/80 hover:shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
