'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserInvites } from '@/lib/api/settings';
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
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Cluster Settings
        </h1>
        <p className="text-base text-muted-foreground mt-1">
          Configure cluster-wide operators, S3 persistent storage, Git integration, TLS domains, and alert channels.
        </p>
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
