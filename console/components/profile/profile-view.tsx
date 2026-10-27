"use client"

import * as React from "react"
import { Activity, Laptop, ShieldCheck, User } from "lucide-react"

import { ProfileActivityTab } from "@/components/profile/profile-activity-tab"
import { ProfileGeneralTab } from "@/components/profile/profile-general-tab"
import { ProfileHeader } from "@/components/profile/profile-header"
import { ProfileSecurityTab } from "@/components/profile/profile-security-tab"
import { ProfileSessionsTab } from "@/components/profile/profile-sessions-tab"
import { siteConfig } from "@/config/site"
import { usePlatformData } from "@/context/platform-data-context"
import { cn } from "@/lib/utils"
import { motion } from "motion/react"

export type ProfileTab = "general" | "security" | "sessions" | "activity"

export const PROFILE_TABS: ProfileTab[] = [
  "general",
  "security",
  "sessions",
  "activity",
]

interface TabItem {
  id: ProfileTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | number
}

export function ProfileView() {
  const { currentUser, sessions } = usePlatformData()
  const [activeTab, setActiveTab] = React.useState<ProfileTab>("general")

  React.useEffect(() => {
    const tabTitles: Record<ProfileTab, string> = {
      general: "Profile",
      security: "Security · Profile",
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
      label: "Security & Credentials",
      icon: ShieldCheck,
      badge: currentUser.twoFactorEnabled ? "2FA Active" : undefined,
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
                  "relative flex items-center gap-2 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="profile-tab-indicator"
                    className="absolute right-0 bottom-0 left-0 h-0.5 bg-primary"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
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
                      "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
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
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="min-h-[420px]"
      >
        {activeTab === "general" && <ProfileGeneralTab />}
        {activeTab === "security" && <ProfileSecurityTab />}
        {activeTab === "sessions" && <ProfileSessionsTab />}
        {activeTab === "activity" && <ProfileActivityTab />}
      </motion.div>
    </div>
  )
}
