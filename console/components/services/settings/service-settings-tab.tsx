'use client';

import React, { useState } from 'react';
import { Service, UpdateServiceInput } from '@/lib/types';
import { useCronJobs } from '@/lib/queries';
import { SettingsNav, SettingsSection } from './settings-nav';
import { GeneralSettingsSection } from './general-settings-section';
import { ResourceLimitsSection } from './resource-limits-section';
import { CronJobsSection } from './cron-jobs-section';
import { WebhookSection } from './webhook-section';
import { DangerZoneSection } from './danger-zone-section';

interface ServiceSettingsTabProps {
  service: Service;
  onUpdateService: (input: UpdateServiceInput) => Promise<void>;
  onRestartService?: () => Promise<void>;
  onStartService?: () => Promise<void>;
  onStopService?: () => Promise<void>;
  onRebuildService?: () => Promise<void>;
}

export function ServiceSettingsTab({
  service,
  onUpdateService,
  onRestartService,
  onStartService,
  onStopService,
  onRebuildService,
}: ServiceSettingsTabProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');

  const { data: cronJobs = [] } = useCronJobs(service.id);

  return (
    <div className="flex flex-col md:flex-row gap-6 lg:gap-8 items-start">
      {/* Sub-Navigation (AC-1) */}
      <SettingsNav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        cronCount={cronJobs.length}
      />

      {/* Main Section Content Area */}
      <div className="flex-1 w-full min-w-0">
        {activeSection === 'general' && (
          <GeneralSettingsSection
            service={service}
            onUpdate={onUpdateService}
          />
        )}

        {activeSection === 'resources' && (
          <ResourceLimitsSection
            service={service}
            onUpdate={onUpdateService}
            onRestart={onRestartService}
          />
        )}

        {activeSection === 'cron' && (
          <CronJobsSection service={service} />
        )}

        {activeSection === 'webhooks' && (
          <WebhookSection service={service} />
        )}

        {activeSection === 'danger' && (
          <DangerZoneSection
            service={service}
            onRestart={onRestartService}
            onStart={onStartService}
            onStop={onStopService}
            onRebuild={onRebuildService}
          />
        )}
      </div>
    </div>
  );
}
