'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserInvites } from '@/lib/api/settings';
import { Settings as SettingsIcon } from 'lucide-react';
import { GlobalSettingsNav, GlobalSettingsSection } from '@/components/settings/settings-nav';
import { OverviewPanel } from '@/components/settings/overview-panel';
import { UsersPanel } from '@/components/settings/users-panel';
import { BucketsPanel } from '@/components/settings/buckets-panel';
import { GitPanel } from '@/components/settings/git-panel';
import { BackupsPanel } from '@/components/settings/backups-panel';
import { DomainPanel } from '@/components/settings/domain-panel';
import { NotificationsPanel } from '@/components/settings/notifications-panel';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<GlobalSettingsSection>('overview');

  const { data: invites = [] } = useQuery({
    queryKey: ['user-invites'],
    queryFn: getUserInvites,
  });

  return (
    <>
      <title>Cluster Settings — Takō Cloud</title>
      <div className="space-y-8">
        {/* Page Header (Base Vega Gradient Hero) */}
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-primary/5 via-background to-background p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
                  Cluster Settings
                </h1>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  <SettingsIcon className="size-3.5 text-primary" />
                  Global Configuration
                </span>
              </div>

              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-normal">
                Configure cluster-wide operators, storage buckets, Git sync, TLS domains, and notifications.
              </p>
            </div>
          </div>
        </div>

      {/* Main Layout: Sub-Nav Sidebar + Active Panel (AC-7) */}
      <div className="flex flex-col md:flex-row gap-6 lg:gap-8 items-start">
        <GlobalSettingsNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          pendingInvitesCount={invites.length}
        />

        <div className="flex-1 w-full min-w-0">
          {activeSection === 'overview' && <OverviewPanel />}
          {activeSection === 'users' && <UsersPanel />}
          {activeSection === 'buckets' && <BucketsPanel />}
          {activeSection === 'git' && <GitPanel />}
          {activeSection === 'backups' && <BackupsPanel />}
          {activeSection === 'domain' && <DomainPanel />}
          {activeSection === 'notifications' && <NotificationsPanel />}
        </div>
      </div>
    </div>
  </>
);
}
