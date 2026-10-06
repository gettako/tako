'use client';

import React from 'react';
import Link from 'next/link';
import { LucideIcon, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: LucideIcon;
  };
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-card/30 p-8 sm:p-12 text-center',
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground ring-8 ring-muted/30">
        <Icon className="size-6 stroke-[1.5]" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Button render={<Link href={action.href} />} className="gap-2">
              {ActionIcon && <ActionIcon className="size-4" />}
              <span>{action.label}</span>
            </Button>
          ) : (
            <Button onClick={action.onClick} className="gap-2">
              {ActionIcon && <ActionIcon className="size-4" />}
              <span>{action.label}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
