"use client"

import * as React from "react"
import { Settings as SettingsIcon } from "lucide-react"

import { BackupsPanel } from "@/components/settings/backups-panel"
import { DomainPanel } from "@/components/settings/domain-panel"
import { GitPanel } from "@/components/settings/git-panel"
import { NetworkPanel } from "@/components/settings/network-panel"
import { NotificationsPanel } from "@/components/settings/notifications-panel"
import { OverviewPanel } from "@/components/settings/overview-panel"
import { RegistriesPanel } from "@/components/settings/registries-panel"
import { S3StorageSection } from "@/components/settings/s3-storage-section"
import {
  SettingsNav,
  SettingsSection,
} from "@/components/settings/settings-nav"
import { UsersPanel } from "@/components/settings/users-panel"
import { siteConfig } from "@/config/site"
import { usePlatformData } from "@/context/platform-data-context"
import { S3BucketConfig } from "@/types/platform"

export function SettingsView() {
  const { settings, updateSettings, invites, registries } = usePlatformData()

  const [activeSection, setActiveSection] =
    React.useState<SettingsSection>("overview")

  React.useEffect(() => {
    const sectionTitles: Record<SettingsSection, string> = {
      overview: "Overview",
      users: "Users & Access",
      registries: "Registries",
      storage: "S3 Storage",
      git: "Git Providers",
      backups: "Backups",
      domain: "Domains",
      notifications: "Notifications",
      network: "Network & Mesh",
    }
    const sectionName = sectionTitles[activeSection]
    const titlePrefix =
      activeSection === "overview" ? "Settings" : `${sectionName} · Settings`
    document.title = `${titlePrefix} | ${siteConfig.name}`
  }, [activeSection])

  // S3 Storage state (Multi-bucket)
  const [s3Buckets, setS3Buckets] = React.useState<S3BucketConfig[]>(
    settings.s3Buckets && settings.s3Buckets.length > 0
      ? settings.s3Buckets
      : []
  )

  const handleBucketsChange = React.useCallback(
    (newBuckets: S3BucketConfig[]) => {
      setS3Buckets(newBuckets)
      const defaultB = newBuckets.find((b) => b.isDefault) || newBuckets[0]
      updateSettings({
        s3Buckets: newBuckets,
        ...(defaultB
          ? {
              s3Endpoint: defaultB.endpoint,
              s3Bucket: defaultB.bucket,
              s3Region: defaultB.region,
              s3AccessKey: defaultB.accessKey,
              s3SecretKey: defaultB.secretKey,
              s3ForcePathStyle: defaultB.forcePathStyle,
              s3RetentionDays: defaultB.retentionDays,
            }
          : {}),
      })
    },
    [updateSettings]
  )

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Cluster Platform Settings
            </h1>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <SettingsIcon className="size-3 text-primary" />
              <span>Global Orchestrator</span>
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Configure cluster-wide operators, storage buckets, Git continuous
            integration, TLS domains, and telemetry policies.
          </p>
        </div>
      </div>

      {/* Main Settings Grid: Sub-Nav Sidebar + Active Panel */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Left Column: Vertical Navigation Tabs */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-span-4 xl:col-span-3">
          <SettingsNav
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            pendingInvitesCount={invites.length}
            bucketsCount={s3Buckets.length}
            registriesCount={registries.length}
          />
        </aside>

        {/* Right Column: Tab Content */}
        <main className="min-w-0 lg:col-span-8 xl:col-span-9">
          {activeSection === "overview" && (
            <OverviewPanel onNavigateToTab={setActiveSection} />
          )}

          {activeSection === "users" && <UsersPanel />}

          {activeSection === "registries" && <RegistriesPanel />}

          {activeSection === "storage" && (
            <S3StorageSection
              buckets={s3Buckets}
              onBucketsChange={handleBucketsChange}
            />
          )}

          {activeSection === "git" && <GitPanel />}

          {activeSection === "backups" && <BackupsPanel />}

          {activeSection === "domain" && <DomainPanel />}

          {activeSection === "notifications" && <NotificationsPanel />}

          {activeSection === "network" && <NetworkPanel />}
        </main>
      </div>
    </div>
  )
}
