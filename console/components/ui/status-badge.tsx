'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Status } from '@/lib/types';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  MinusCircle,
  Clock,
} from 'lucide-react';

export type ExtendedStatus =
  | Status
  | 'online'
  | 'offline'
  | 'live'
  | 'running'
  | 'failed'
  | 'success'
  | 'pending'
  | 'skipped'
  | 'cancelled';

interface StatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
  pulse?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

const statusConfigs: Record<string, StatusConfig> = {
  // Healthy / Online / Success
  healthy: {
    label: 'Healthy',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/25',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  online: {
    label: 'Online',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/25',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  live: {
    label: 'Live',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/25',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  success: {
    label: 'Success',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/25',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle2,
  },

  // Danger / Offline / Failed
  unhealthy: {
    label: 'Unhealthy',
    badgeClass: 'bg-red-500/10 text-red-700 dark:bg-[#FF5A6A]/15 dark:text-[#FF5A6A] border-red-500/20 dark:border-[#FF5A6A]/30',
    dotClass: 'bg-red-500 dark:bg-[#FF5A6A]',
    icon: XCircle,
  },
  offline: {
    label: 'Offline',
    badgeClass: 'bg-red-500/10 text-red-700 dark:bg-[#FF5A6A]/15 dark:text-[#FF5A6A] border-red-500/20 dark:border-[#FF5A6A]/30',
    dotClass: 'bg-red-500 dark:bg-[#FF5A6A]',
    icon: XCircle,
  },
  failed: {
    label: 'Failed',
    badgeClass: 'bg-red-500/10 text-red-700 dark:bg-[#FF5A6A]/15 dark:text-[#FF5A6A] border-red-500/20 dark:border-[#FF5A6A]/30',
    dotClass: 'bg-red-500 dark:bg-[#FF5A6A]',
    icon: XCircle,
  },

  // Info / Deploying / Running
  deploying: {
    label: 'Deploying',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:bg-[#98A4F7]/15 dark:text-[#98A4F7] border-blue-500/20 dark:border-[#98A4F7]/30',
    dotClass: 'bg-blue-500 dark:bg-[#98A4F7]',
    pulse: true,
    icon: Loader2,
  },
  running: {
    label: 'Running',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:bg-[#98A4F7]/15 dark:text-[#98A4F7] border-blue-500/20 dark:border-[#98A4F7]/30',
    dotClass: 'bg-blue-500 dark:bg-[#98A4F7]',
    pulse: true,
    icon: Loader2,
  },

  // Warning / Degraded / Pending
  degraded: {
    label: 'Degraded',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/25',
    dotClass: 'bg-amber-500',
    icon: AlertTriangle,
  },
  warning: {
    label: 'Warning',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/25',
    dotClass: 'bg-amber-500',
    icon: AlertTriangle,
  },
  pending: {
    label: 'Pending',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/25',
    dotClass: 'bg-amber-500',
    icon: Clock,
  },

  // Neutral / Stopped / Queued / Skipped / Cancelled
  stopped: {
    label: 'Stopped',
    badgeClass: 'bg-neutral-500/10 text-neutral-700 dark:bg-[#939DB8]/15 dark:text-[#939DB8] border-neutral-500/20 dark:border-[#939DB8]/30',
    dotClass: 'bg-neutral-500 dark:bg-[#939DB8]',
    icon: MinusCircle,
  },
  queued: {
    label: 'Queued',
    badgeClass: 'bg-neutral-500/10 text-neutral-700 dark:bg-[#939DB8]/15 dark:text-[#939DB8] border-neutral-500/20 dark:border-[#939DB8]/30',
    dotClass: 'bg-neutral-500 dark:bg-[#939DB8]',
    icon: Clock,
  },
  skipped: {
    label: 'Skipped',
    badgeClass: 'bg-neutral-500/10 text-neutral-700 dark:bg-[#939DB8]/15 dark:text-[#939DB8] border-neutral-500/20 dark:border-[#939DB8]/30 border-dashed',
    dotClass: 'bg-neutral-500 dark:bg-[#939DB8]',
    icon: MinusCircle,
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'bg-neutral-500/10 text-neutral-700 dark:bg-[#939DB8]/15 dark:text-[#939DB8] border-neutral-500/20 dark:border-[#939DB8]/30',
    dotClass: 'bg-neutral-500 dark:bg-[#939DB8]',
    icon: MinusCircle,
  },
};

export interface StatusBadgeProps {
  status: ExtendedStatus | string;
  showIcon?: boolean;
  showDot?: boolean;
  label?: string;
  className?: string;
  size?: 'sm' | 'default';
}

export function StatusBadge({
  status,
  showIcon = false,
  showDot = true,
  label,
  className,
  size = 'default',
}: StatusBadgeProps) {
  const normalizedKey = status.toLowerCase();
  const config = statusConfigs[normalizedKey] || {
    label: status,
    badgeClass: 'bg-neutral-500/10 text-neutral-700 dark:bg-neutral-500/15 dark:text-neutral-400 border-neutral-500/20',
    dotClass: 'bg-neutral-500',
    icon: MinusCircle,
  };

  const displayLabel = label || config.label;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium select-none',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        config.badgeClass,
        className
      )}
    >
      {showDot && (
        <span className="relative flex size-2 items-center justify-center shrink-0">
          {config.pulse && (
            <span
              className={cn(
                'absolute inline-flex size-full rounded-full opacity-75 animate-ping motion-reduce:hidden',
                config.dotClass
              )}
            />
          )}
          <span className={cn('relative inline-flex size-1.5 rounded-full', config.dotClass)} />
        </span>
      )}
      {showIcon && <Icon className="size-3 shrink-0" />}
      <span>{displayLabel}</span>
    </span>
  );
}
