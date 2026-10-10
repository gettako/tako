import * as React from 'react';
import { LucideIcon } from 'lucide-react';
import { SectionHeader, SectionHeaderProps } from '@/components/ui/section-header';

export interface SettingsSectionHeaderProps extends SectionHeaderProps {
  /** Optional badge or pill to display alongside title or action */
  badge?: React.ReactNode;
}

/**
 * SettingsSectionHeader
 * Reusable standardized section header component for all settings cards and panels.
 * Consistent typography: font-semibold text-base, tracking-tight, leading-snug.
 * Consistent icon wrapper: size-10 rounded-xl border border-border bg-muted/40.
 */
export function SettingsSectionHeader({
  action,
  badge,
  ...props
}: SettingsSectionHeaderProps) {
  const combinedAction =
    badge && action ? (
      <div className="flex items-center gap-2">
        {action}
        {badge}
      </div>
    ) : (
      action || badge
    );

  return <SectionHeader action={combinedAction} {...props} />;
}

export { SectionHeader };
