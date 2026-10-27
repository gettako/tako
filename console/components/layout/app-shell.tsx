"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "motion/react"

import { ControlPlaneLoading } from "@/components/layout/control-plane-loading"
import { GlobalCommandPalette } from "@/components/command-palette/global-command-palette"
import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { MobileNavigation } from "@/components/layout/mobile-navigation"
import { usePlatformData } from "@/context/platform-data-context"
import { buildBreadcrumbs } from "@/lib/breadcrumbs"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const { nodes, projects, services, status, error } = usePlatformData()

  const breadcrumbs = React.useMemo(
    () => buildBreadcrumbs(pathname, { nodes, projects, services }),
    [pathname, nodes, projects, services]
  )

  const navBadges: Record<string, string | undefined> = {
    "/projects": projects.length > 0 ? `${projects.length}` : undefined,
    "/nodes": nodes.length > 0 ? `${nodes.length}` : undefined,
  }

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router])

  if (status === "loading") {
    return <ControlPlaneLoading />
  }

  if (status === "unauthenticated") {
    return null
  }

  if (status === "error") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-2 rounded-lg border border-destructive/30 bg-card p-5 text-center">
          <p className="text-sm font-semibold text-foreground">
            Control plane unavailable
          </p>
          <p className="text-xs text-muted-foreground">
            {error || "The Tako server did not respond."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <AppSidebar isCollapsed={isCollapsed} navBadges={navBadges} />

      <MobileNavigation
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        navBadges={navBadges}
      />

      {/* Main Content Area */}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader
          breadcrumbs={breadcrumbs}
          isCollapsed={isCollapsed}
          onOpenMobileNavigation={() => setMobileMenuOpen(true)}
          onToggleSidebar={() => setIsCollapsed((prev) => !prev)}
        />

        {/* Page Content: Scrollable independent area with stable scrollbar gutter and smooth page transition */}
        <main className="flex-1 [scrollbar-gutter:stable] overflow-y-auto p-4 pb-28 sm:p-6 lg:px-8 lg:py-6">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full"
          >
            {children}
          </motion.div>
        </main>

        {/* Global ⌘K command palette */}
        <GlobalCommandPalette />
      </div>
    </div>
  )
}
