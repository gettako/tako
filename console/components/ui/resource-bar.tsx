'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ResourceBarProps {
  label?: string;
  value: number;
  max?: number;
  unit?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function ResourceBar({
  label,
  value,
  max = 100,
  unit,
  showPercentage = true,
  size = 'default',
  className,
}: ResourceBarProps) {
  const percentage = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  const roundedPercent = Math.round(percentage);

  // Dynamic threshold colors: <70% success, 70-90% warning, >=90% danger
  const getBarColor = (pct: number) => {
    if (pct >= 90) return 'bg-status-danger';
    if (pct >= 70) return 'bg-status-warning';
    return 'bg-status-success';
  };

  const barColor = getBarColor(percentage);

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          {label && <span className="font-medium text-muted-foreground shrink-0">{label}</span>}
          <div className="flex items-center gap-1 font-mono text-[11px] text-foreground whitespace-nowrap">
            {size === 'sm' ? (
              <span>{unit === '%' ? `${value}%` : `${value}${unit ? ` ${unit}` : ''}`}</span>
            ) : (
              <span>
                {value}{max !== 100 ? ` / ${max}` : ''}{unit ? ` ${unit}` : ''}
              </span>
            )}
            {showPercentage && size !== 'sm' && (
              <span className="font-semibold text-muted-foreground">({roundedPercent}%)</span>
            )}
          </div>
        </div>
      )}

      {/* Progress track */}
      <div
        className={cn( 'w-full overflow-hidden rounded-full bg-muted/80', size === 'sm' ? 'h-1.5' : 'h-2' )}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300 ease-out', barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
