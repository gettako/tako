import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChartCardProps extends React.ComponentProps<typeof Card> {}

export function ChartCard({ className, children, ...props }: ChartCardProps) {
  return (
    <Card
      data-slot="chart-card"
      className={cn('rounded-xl border border-border bg-card transition-colors overflow-hidden', className)}
      {...props}
    >
      {children}
    </Card>
  );
}

export interface ChartCardIconProps extends React.ComponentProps<'div'> {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  iconClassName?: string;
}

export function ChartCardIcon({
  icon: Icon,
  className,
  iconClassName,
  children,
  ...props
}: ChartCardIconProps) {
  if (!Icon && !children) return null;

  return (
    <div
      data-slot="chart-icon"
      className={cn(
        'flex size-9 sm:size-10 items-center justify-center rounded-xl border border-border bg-muted/40 text-foreground shrink-0',
        className
      )}
      {...props}
    >
      {Icon ? <Icon className={cn('size-4 sm:size-5', iconClassName)} /> : children}
    </div>
  );
}

export interface ChartCardTitleProps extends React.ComponentProps<typeof CardTitle> {
  noTruncate?: boolean;
}

export function ChartCardTitle({
  className,
  noTruncate = false,
  children,
  ...props
}: ChartCardTitleProps) {
  return (
    <CardTitle
      data-slot="chart-title"
      className={cn(
        'text-sm sm:text-base font-semibold tracking-tight text-foreground',
        !noTruncate && 'truncate',
        className
      )}
      {...props}
    >
      {children}
    </CardTitle>
  );
}

export interface ChartCardDescriptionProps extends React.ComponentProps<typeof CardDescription> {
  noTruncate?: boolean;
}

export function ChartCardDescription({
  className,
  noTruncate = false,
  children,
  ...props
}: ChartCardDescriptionProps) {
  return (
    <CardDescription
      data-slot="chart-description"
      className={cn(
        'text-xs text-muted-foreground mt-0.5',
        !noTruncate && 'truncate',
        className
      )}
      {...props}
    >
      {children}
    </CardDescription>
  );
}

export interface ChartCardActionProps extends React.ComponentProps<'div'> {}

export function ChartCardAction({ className, children, ...props }: ChartCardActionProps) {
  if (!children) return null;

  return (
    <div
      data-slot="chart-action"
      className={cn('flex items-center gap-2 shrink-0 self-start sm:self-auto', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ChartCardHeaderProps extends Omit<React.ComponentProps<typeof CardHeader>, 'title'> {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  actionLayout?: 'responsive' | 'inline';
  noTruncate?: boolean;
  iconClassName?: string;
  iconContainerClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  actionClassName?: string;
}

export function ChartCardHeader({
  icon,
  title,
  description,
  action,
  actionLayout = 'responsive',
  noTruncate = false,
  iconClassName,
  iconContainerClassName,
  titleClassName,
  descriptionClassName,
  actionClassName,
  className,
  children,
  ...props
}: ChartCardHeaderProps) {
  const hasSlotProps = title != null || icon != null || description != null || action != null;

  return (
    <CardHeader
      data-slot="chart-card-header"
      className={cn('pb-2', className)}
      {...props}
    >
      {hasSlotProps ? (
        <div
          className={cn(
            'gap-3',
            actionLayout === 'inline'
              ? 'flex items-center justify-between'
              : 'flex flex-col sm:flex-row sm:items-center sm:justify-between'
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <ChartCardIcon
                icon={icon}
                className={iconContainerClassName}
                iconClassName={iconClassName}
              />
            )}
            <div className="space-y-0.5 min-w-0">
              {title && (
                <ChartCardTitle className={titleClassName} noTruncate={noTruncate}>
                  {title}
                </ChartCardTitle>
              )}
              {description && (
                <ChartCardDescription className={descriptionClassName} noTruncate={noTruncate}>
                  {description}
                </ChartCardDescription>
              )}
            </div>
          </div>

          {action && (
            <ChartCardAction
              className={cn(
                actionLayout === 'inline' && 'self-auto shrink-0',
                actionClassName
              )}
            >
              {action}
            </ChartCardAction>
          )}

          {children}
        </div>
      ) : (
        children
      )}
    </CardHeader>
  );
}

export interface ChartCardContentProps extends React.ComponentProps<typeof CardContent> {
  isLoading?: boolean;
  skeletonHeight?: string;
}

export function ChartCardContent({
  isLoading = false,
  skeletonHeight = 'h-56',
  className,
  children,
  ...props
}: ChartCardContentProps) {
  return (
    <CardContent
      data-slot="chart-card-content"
      className={cn('pt-2', className)}
      {...props}
    >
      {isLoading ? (
        <div className={cn(skeletonHeight, 'w-full animate-pulse rounded-md bg-muted/40')} />
      ) : (
        children
      )}
    </CardContent>
  );
}

export { ChartCardHeader as ChartHeader };
