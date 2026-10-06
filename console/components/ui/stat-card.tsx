'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatChange {
  value: string | number;
  trend: 'up' | 'down' | 'neutral';
  label?: string;
}

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: React.ComponentType<{ className?: string }>;
  change?: StatChange;
  statusAccent?: 'healthy' | 'unhealthy' | 'warning' | 'degraded' | 'info' | 'neutral' | string;
}

export function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  change,
  statusAccent,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xs transition-colors overflow-hidden',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {Icon && (
          <div className="flex size-8 items-center justify-center rounded-lg border border-border/80 bg-muted/40 text-muted-foreground shrink-0">
            <Icon className="size-4" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-bold tracking-tight text-3xl text-foreground font-sans">
          {value}
        </span>
        {change && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium font-mono',
              change.trend === 'up' && 'text-status-success',
              change.trend === 'down' && 'text-status-danger',
              change.trend === 'neutral' && 'text-muted-foreground'
            )}
          >
            {change.trend === 'up' && <ArrowUpRight className="size-3" />}
            {change.trend === 'down' && <ArrowDownRight className="size-3" />}
            {change.trend === 'neutral' && <Minus className="size-3" />}
            <span>{change.value}</span>
          </span>
        )}
      </div>

      {(subtext || change?.label) && (
        <p className="mt-1.5 text-sm text-muted-foreground">
          {subtext || change?.label}
        </p>
      )}
    </div>
  );
}
