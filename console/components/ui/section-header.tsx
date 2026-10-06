import * as React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardDescription, CardTitle } from '@/components/ui/card';

export interface SectionHeaderProps {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  iconClassName?: string;
  iconContainerClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
  className,
  iconClassName,
  iconContainerClassName,
  titleClassName,
  descriptionClassName,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3',
        className
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && (
          <div
            className={cn(
              'flex size-10 items-center justify-center rounded-xl border border-border/80 bg-muted/40 shadow-2xs shrink-0',
              iconContainerClassName
            )}
          >
            <Icon className={cn('size-5 text-foreground', iconClassName)} />
          </div>
        )}
        <div className="space-y-0.5 min-w-0">
          <CardTitle
            className={cn(
              'text-base font-semibold tracking-tight text-foreground leading-snug',
              titleClassName
            )}
          >
            {title}
          </CardTitle>
          {description && (
            <CardDescription
              className={cn(
                'text-sm text-muted-foreground mt-0.5 leading-normal',
                descriptionClassName
              )}
            >
              {description}
            </CardDescription>
          )}
        </div>
      </div>
      {action && (
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {action}
        </div>
      )}
    </div>
  );
}
