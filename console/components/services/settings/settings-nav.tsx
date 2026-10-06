'use client';

import React from 'react';
import { Sliders, Cpu, Clock, Webhook, AlertTriangle } from 'lucide-react';
import { cn } from 'cn';

export type SettingsSection = 'general' | 'resources' | 'cron' | 'webhooks' | 'danger';

interface SettingsNavProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  cronCount?: number;
}

interface NavItem {
  id: SettingsSection;
  label: string;
  description: string;
  icon: React.ElementType;
  badge?: number | string;
  isDestructive?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Name, Git repo, branch, build command',
    icon: Sliders,
  },
  {
    id: 'resources',
    label: 'Resource Limits',
    description: 'CPU, memory, and swap quotas',
    icon: Cpu,
  },
  {
    id: 'cron',
    label: 'Cron Jobs',
    description: 'Scheduled auxiliary tasks & commands',
    icon: Clock,
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    description: 'Automatic deployment triggers & logs',
    icon: Webhook,
  },
  {
    id: 'danger',
    label: 'Danger Zone',
    description: 'Restart, rebuild, or delete service',
    icon: AlertTriangle,
    isDestructive: true,
  },
];

export function SettingsNav({
  activeSection,
  onSectionChange,
  cronCount,
}: SettingsNavProps) {
  return (
    <>
      {/* Mobile Horizontal Pill Scroll */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-2 border-b border-border/60 scrollbar-none">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border',
                isActive
                  ? item.isDestructive
                    ? 'bg-status-danger/10 border-status-danger/40 text-status-danger'
                    : 'bg-primary/10 border-primary/30 text-primary font-semibold'
                  : 'bg-card border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
              {item.id === 'cron' && cronCount !== undefined && cronCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-muted font-mono">
                  {cronCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop Vertical Sidebar */}
      <nav className="hidden md:flex flex-col gap-1.5 w-64 shrink-0">
        <div className="px-3 pb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Service Settings
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                'group flex items-start gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border',
                isActive
                  ? item.isDestructive
                    ? 'bg-status-danger/10 border-status-danger/40 text-status-danger shadow-xs'
                    : 'bg-primary/10 border-primary/30 text-primary font-medium shadow-xs'
                  : item.isDestructive
                  ? 'border-transparent text-status-danger/80 hover:bg-status-danger/5 hover:text-status-danger'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <div
                className={cn(
                  'mt-0.5 p-1 rounded-md transition-colors',
                  isActive
                    ? item.isDestructive
                      ? 'bg-status-danger/20 text-status-danger'
                      : 'bg-primary/20 text-primary'
                    : 'text-muted-foreground group-hover:text-foreground'
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={cn('font-medium text-sm', isActive && 'font-semibold')}>
                    {item.label}
                  </span>
                  {item.id === 'cron' && cronCount !== undefined && cronCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-xs bg-muted/80 text-muted-foreground font-mono">
                      {cronCount}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </nav>
    </>
  );
}
