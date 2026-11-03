"use client"

import * as React from "react"
import { Settings as SettingsIcon } from "lucide-react"
import { motion } from "motion/react"

import { BackupsPanel } from "@/components/settings/backups-panel"
import { DomainPanel } from "@/components/settings/domain-panel"
import { GitPanel } from "@/components/settings/git-panel"
import { NetworkPanel } from "@/components/settings/network-panel"
import { NotificationsPanel } from "@/components/settings/notifications-panel"
import { OverviewPanel } from "@/components/settings/overview-panel"
import { RegistriesPanel } from "@/components/settings/registries-panel"
import { S3StorageSection } from "@/components/settings/s3-storage-section"
import {
  SETTINGS_SECTION,
  SettingsNav,
  SettingsSection,
} from "@/components/settings/settings-nav"
import { UsersPanel } from "@/components/settings/users-panel"
import { siteConfig } from "@/config/site"
import { usePlatformData } from "@/context/platform-data-context"
import { S3BucketConfig } from "@/types/platform"

const VALID_SECTIONS = Object.values(SETTINGS_SECTION)

function getSectionFromLocation(): SettingsSection | null {
  if (typeof window === "undefined") return null
  const hash = window.location.hash.replace(/^#/, "").toLowerCase()
  if (VALID_SECTIONS.includes(hash as SettingsSection)) {
    return hash as SettingsSection
  }
  const params = new URLSearchParams(window.location.search)
  const tab = params.get("tab")?.toLowerCase()
  if (tab && VALID_SECTIONS.includes(tab as SettingsSection)) {
    return tab as SettingsSection
  }
  return null
}

export function SettingsView() {
  const { settings, updateSettings, invites, registries } = usePlatformData()

  const [activeSection, setActiveSection] = React.useState<SettingsSection>(
    () => getSectionFromLocation() || SETTINGS_SECTION.OVERVIEW
  )

  // Sync with browser URL hash & history navigation
  React.useEffect(() => {
    const handleLocationChange = () => {
      const fromUrl = getSectionFromLocation()
      if (fromUrl) {
        setActiveSection(fromUrl)
      }
    }

    handleLocationChange()

    window.addEventListener("hashchange", handleLocationChange)
    window.addEventListener("popstate", handleLocationChange)
    return () => {
      window.removeEventListener("hashchange", handleLocationChange)
      window.removeEventListener("popstate", handleLocationChange)
    }
  }, [])

  const handleSectionChange = React.useCallback(
    (section: SettingsSection) => {
      setActiveSection(section)
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href)
        url.hash = section === SETTINGS_SECTION.OVERVIEW ? "" : section
        url.searchParams.delete("tab")
        window.history.pushState(null, "", url.toString())
      }
    },
    []
  )

  React.useEffect(() => {
    const sectionTitles: Record<SettingsSection, string> = {
      [SETTINGS_SECTION.OVERVIEW]: "Overview",
      [SETTINGS_SECTION.USERS]: "Users & Access",
      [SETTINGS_SECTION.REGISTRIES]: "Registries",
      [SETTINGS_SECTION.STORAGE]: "S3 Storage",
      [SETTINGS_SECTION.GIT]: "Git Providers",
      [SETTINGS_SECTION.BACKUPS]: "Backups",
      [SETTINGS_SECTION.DOMAIN]: "Domains",
      [SETTINGS_SECTION.NOTIFICATIONS]: "Notifications",
      [SETTINGS_SECTION.NETWORK]: "Network & Mesh",
    }
    const sectionName = sectionTitles[activeSection]
    const titlePrefix =
      activeSection === SETTINGS_SECTION.OVERVIEW
        ? "Settings"
        : `${sectionName} · Settings`
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
            onSectionChange={handleSectionChange}
            pendingInvitesCount={invites.length}
            bucketsCount={s3Buckets.length}
            registriesCount={registries.length}
          />
        </aside>

        {/* Right Column: Tab Content */}
        <main className="min-w-0 lg:col-span-8 xl:col-span-9">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {activeSection === SETTINGS_SECTION.OVERVIEW && (
              <OverviewPanel onNavigateToTab={handleSectionChange} />
            )}

            {activeSection === SETTINGS_SECTION.USERS && <UsersPanel />}

            {activeSection === SETTINGS_SECTION.REGISTRIES && (
              <RegistriesPanel />
            )}

            {activeSection === SETTINGS_SECTION.STORAGE && (
              <S3StorageSection
                buckets={s3Buckets}
                onBucketsChange={handleBucketsChange}
              />
            )}

            {activeSection === SETTINGS_SECTION.GIT && <GitPanel />}

            {activeSection === SETTINGS_SECTION.BACKUPS && <BackupsPanel />}

            {activeSection === SETTINGS_SECTION.DOMAIN && <DomainPanel />}

            {activeSection === SETTINGS_SECTION.NOTIFICATIONS && (
              <NotificationsPanel />
            )}

            {activeSection === SETTINGS_SECTION.NETWORK && <NetworkPanel />}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
