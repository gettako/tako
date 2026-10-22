"use client"

import * as React from "react"
import {
  Activity,
  Fingerprint,
  Laptop,
  ShieldCheck,
  User,
} from "lucide-react"

import { ProfileActivityTab } from "@/components/profile/profile-activity-tab"
import { ProfileGeneralTab } from "@/components/profile/profile-general-tab"
import { ProfileHeader } from "@/components/profile/profile-header"
import { ProfilePasskeysTab } from "@/components/profile/profile-passkeys-tab"
import { ProfileSecurityTab } from "@/components/profile/profile-security-tab"
import { ProfileSessionsTab } from "@/components/profile/profile-sessions-tab"
import { siteConfig } from "@/config/site"
import { usePlatformData } from "@/context/platform-data-context"
import { cn } from "@/lib/utils"

export type ProfileTab =
  | "general"
  | "security"
  | "passkeys"
  | "sessions"
  | "activity"

interface TabItem {
  id: ProfileTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | number
}

export function ProfileView() {
  const { currentUser, passkeys, sessions } = usePlatformData()
  const [activeTab, setActiveTab] = React.useState<ProfileTab>("general")

  React.useEffect(() => {
    const tabTitles: Record<ProfileTab, string> = {
      general: "Profile",
      security: "Security & 2FA · Profile",
      passkeys: "Passkeys · Profile",
      sessions: "Sessions · Profile",
      activity: "Activity Log · Profile",
    }
    const titlePrefix = tabTitles[activeTab] || "Profile"
    document.title = `${titlePrefix} | ${siteConfig.name}`
  }, [activeTab])

  const tabs: TabItem[] = [
    {
      id: "general",
      label: "General Profile",
      icon: User,
    },
    {
      id: "security",
      label: "Security & 2FA",
      icon: ShieldCheck,
      badge: currentUser.twoFactorEnabled ? "2FA Active" : undefined,
    },
    {
      id: "passkeys",
      label: "Hardware Passkeys",
      icon: Fingerprint,
      badge: passkeys.length,
    },
    {
      id: "sessions",
      label: "Active Sessions",
      icon: Laptop,
      badge: sessions.length,
    },
    {
      id: "activity",
      label: "Audit Activity",
      icon: Activity,
    },
  ]

  return (
    <div className="space-y-6">
      {/* 1. Header with Operator Credentials */}
      <ProfileHeader />

      {/* 2. Responsive Tab Navigation */}
      <div className="border-b border-border">
        <nav
          aria-label="Profile Sections"
          className="flex scrollbar-none space-x-1 overflow-x-auto pb-px"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-3.5 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={cn(
                      "py-0.2 rounded-full px-1.5 font-mono text-[10px]",
                      isActive
                        ? "bg-primary/10 font-semibold text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* 3. Tab Content View */}
      <div className="min-h-[420px]">
        {activeTab === "general" && <ProfileGeneralTab />}
        {activeTab === "security" && <ProfileSecurityTab />}
        {activeTab === "passkeys" && <ProfilePasskeysTab />}
        {activeTab === "sessions" && <ProfileSessionsTab />}
        {activeTab === "activity" && <ProfileActivityTab />}
      </div>
    </div>
  )
}
