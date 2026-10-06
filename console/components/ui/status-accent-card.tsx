'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Status } from '@/lib/types';


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
  return (
    <div
      className={cn( 'relative rounded-xl border border-border bg-card p-4 sm:p-5 text-card-foreground overflow-hidden', hoverable && 'transition-colors duration-150 hover:border-foreground/40', className )}
      {...props}
    >
      {children}
    </div>
  );
}
