'use client';

import React from 'react';
import {
  Sliders,
  Users,
  HardDrive,
  FolderGit2,
  Database,
  Globe,
  Bell,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type GlobalSettingsSection =
  | 'overview'
  | 'users'
  | 'buckets'
  | 'git'
  | 'backups'
  | 'domain'
  | 'notifications';

interface SettingsNavProps {
  activeSection: GlobalSettingsSection;
  onSectionChange: (section: GlobalSettingsSection) => void;
  pendingInvitesCount?: number;
}

interface NavItem {
  id: GlobalSettingsSection;
  label: string;
  description: string;
  icon: React.ElementType;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'System health & Tako version',
    icon: LayoutDashboard,
  },
  {
    id: 'users',
    label: 'Team & RBAC',
    description: 'Members, roles, and invite links',
    icon: Users,
  },
  {
    id: 'buckets',
    label: 'S3 Storage',
    description: 'Buckets for volume & db snapshots',
    icon: HardDrive,
  },
  {
    id: 'git',
    label: 'Git Providers',
    description: 'GitHub App & synced repositories',
    icon: FolderGit2,
  },
  {
    id: 'backups',
    label: 'Backups',
    description: 'Tako database automated snapshots',
    icon: Database,
  },
  {
    id: 'domain',
    label: 'Cluster Domain',
    description: 'Control plane DNS & SSL certificates',
    icon: Globe,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Email, Slack, and Telegram channels',
    icon: Bell,
  },
];

export function GlobalSettingsNav({
  activeSection,
  onSectionChange,
  pendingInvitesCount,
}: SettingsNavProps) {
  return (
    <>
      {/* Mobile Horizontal Pill Scroll */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-2 border-b border-border scrollbar-none">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn( 'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border', isActive ? 'bg-primary/10 border-primary/40 text-primary font-semibold' : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/50' )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
              {item.id === 'users' && pendingInvitesCount !== undefined && pendingInvitesCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs bg-muted font-mono">
                  {pendingInvitesCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop Vertical Sidebar */}
      <nav className="hidden md:flex flex-col gap-1.5 w-64 shrink-0">
        <div className="px-3 pb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Cluster Settings
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn( 'group flex items-start gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border', isActive ? 'bg-primary/10 border-primary/30 text-primary font-medium ' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60' )}
            >
              <div
                className={cn( 'mt-0.5 p-1 rounded-md transition-colors', isActive ? 'bg-primary/20 text-primary' : 'text-muted-foreground group-hover:text-foreground' )}
              >
                <Icon className="size-4 shrink-0" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={cn('text-sm font-medium text-foreground', isActive && 'font-semibold text-primary')}>
                    {item.label}
                  </span>
                  {item.id === 'users' && pendingInvitesCount !== undefined && pendingInvitesCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-muted/80 text-muted-foreground font-mono">
                      {pendingInvitesCount}
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
