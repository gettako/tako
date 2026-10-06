'use client';

import React from 'react';
import {
  Activity,
  KeyRound,
  Rocket,
  ScrollText,
  Terminal,
  Globe,
  Settings,
  Database,
  Archive,
} from 'lucide-react';
import { ServiceType } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function getTabsForService(type: ServiceType): TabItem[] {
  if (type === 'database') {
    return [
      { id: 'overview', label: 'Overview', icon: Activity },
      { id: 'connection', label: 'Connection', icon: Database },
      { id: 'backups', label: 'Backups', icon: Archive },
      { id: 'env', label: 'Environment', icon: KeyRound },
      { id: 'logs', label: 'Logs', icon: ScrollText },
      { id: 'terminal', label: 'Terminal', icon: Terminal },
      { id: 'settings', label: 'Settings', icon: Settings },
    ];
  }

  return [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'env', label: 'Environment', icon: KeyRound },
    { id: 'deployments', label: 'Deployments', icon: Rocket },
    { id: 'logs', label: 'Logs', icon: ScrollText },
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'domains', label: 'Domains', icon: Globe },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];
}

export interface ServiceTabsProps {
  serviceType: ServiceType;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function ServiceTabs({
  serviceType,
  activeTab,
  onTabChange,
  className,
}: ServiceTabsProps) {
  const tabs = getTabsForService(serviceType);

  return (
    <div className={cn('border-b border-border overflow-x-auto scrollbar-none', className)}>
      <nav className="flex space-x-1 sm:space-x-2 min-w-max pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn( 'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium transition-colors select-none whitespace-nowrap', isActive ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border' )}
            >
              <Icon className={cn('size-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
