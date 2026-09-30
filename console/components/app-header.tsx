"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ClockIcon,
  ListIcon,
  GaugeIcon,
  FolderSimpleIcon,
  HardDrivesIcon,
  GearSixIcon,
  BookOpenIcon,
  ArrowSquareOutIcon,
} from "@phosphor-icons/react"
import { cn } from "cn"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/status-badge"
import { NavUser } from "@/components/nav-user"
import { useApi, type Server } from "@/lib/api"

export function formatSegmentLabel(segment: string): string {
  if (segment === "projects") return "Projects"
  if (segment === "servers") return "Servers"
  if (segment === "settings") return "Settings"
  if (segment === "security") return "Security"
  if (segment === "dashboard") return "Dashboard"
  if (segment === "profile") return "Profile"
  if (segment === "audit") return "Audit Log"
  if (segment === "github") return "GitHub"
  if (segment === "storage") return "Storage"
  if (segment === "users") return "Users"
  if (segment === "services") return "Services"
  if (segment === "deployments") return "Deployments"
  if (segment === "domains") return "Domains"
  if (segment === "environment") return "Environment"
  if (segment === "monitoring") return "Monitoring"
  if (segment === "backups") return "Backups"
  if (segment === "terminal") return "Terminal"
  if (segment === "auxiliary") return "Auxiliary"
  if (segment.startsWith("prj_") || segment.startsWith("srv_")) return segment
  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

export function getPageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0 || segments[0] === "dashboard") {
    return "Tako - Dashboard"
  }
  if (segments[0] === "login") return "Tako - Login"
  if (segments[0] === "register") return "Tako - Register"
  if (segments[0] === "profile") return "Tako - Profile"

  const lastSegment = segments[segments.length - 1]
  const label = formatSegmentLabel(lastSegment)
  return `Tako - ${label}`
}

export function isRouteActive(
  currentPath: string,
  targetHref: string
): boolean {
  if (targetHref === "/") {
    return currentPath === "/" || currentPath === "/dashboard"
  }
  return currentPath === targetHref || currentPath.startsWith(`${targetHref}/`)
}

export function ServerTime() {
  const [time, setTime] = React.useState<string | null>(null)

  React.useEffect(() => {
    const update = () => {
      const now = new Date()
      const hours = String(now.getUTCHours()).padStart(2, "0")
      const minutes = String(now.getUTCMinutes()).padStart(2, "0")
      const seconds = String(now.getUTCSeconds()).padStart(2, "0")
      setTime(`${hours}:${minutes}:${seconds} UTC`)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div
      data-testid="server-time"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 font-mono text-xs text-muted-foreground select-none sm:h-7"
      title="Server Time (UTC)"
      aria-label={time ? `Server time: ${time}` : "Server time"}
    >
      <ClockIcon
        className="size-3.5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span>{time ?? "--:--:-- UTC"}</span>
    </div>
  )
}

export const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: GaugeIcon,
  },
  {
    title: "Projects",
    href: "/projects",
    icon: FolderSimpleIcon,
  },
  {
    title: "Servers",
    href: "/servers",
    icon: HardDrivesIcon,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: GearSixIcon,
  },
]

export interface MobileNavContentProps {
  pathname?: string
  onClose?: () => void
  servers?: Server[] | null
  loadingServers?: boolean
  serverError?: boolean
}

export function MobileNavContent({
  pathname = "/",
  onClose,
  servers,
  loadingServers = false,
  serverError = false,
}: MobileNavContentProps) {
  const totalServers = servers?.length ?? 0
  const onlineServers =
    servers?.filter((s) => s.status === "online").length ?? 0

  return (
    <div className="flex h-full flex-col justify-between bg-card text-card-foreground">
      <div className="flex flex-col gap-4 p-4">
        <SheetHeader className="border-b border-border p-0 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex aspect-square size-8 items-center justify-center rounded-md border border-border bg-muted/30">
              <img
                src="/icon.svg"
                alt="Tako"
                className="size-5 object-contain"
              />
            </div>
            <div className="flex flex-col">
              <SheetTitle className="text-sm font-semibold tracking-tight text-foreground">
                Tako Control Plane
              </SheetTitle>
              <SheetDescription className="font-mono text-2xs text-muted-foreground">
                Self-Hosted PaaS
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <nav className="flex flex-col gap-1.5" aria-label="Mobile Navigation">
          {navItems.map((item) => {
            const active = isRouteActive(pathname, item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                data-active={active ? "true" : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon
                  className="size-4 shrink-0"
                  weight="duotone"
                  aria-hidden="true"
                />
                <span>{item.title}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border pt-2">
          <a
            href="https://github.com/gettako/tako"
            target="_blank"
            rel="noreferrer"
            className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <BookOpenIcon className="size-4 shrink-0" aria-hidden="true" />
            <span>Documentation</span>
            <ArrowSquareOutIcon
              className="ml-auto size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          </a>
        </div>
      </div>

      <SheetFooter className="flex flex-col gap-3 border-t border-border bg-muted/20 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-muted-foreground">Cluster</span>
          <div data-testid="mobile-node-connectivity-pill">
            {loadingServers ? (
              <Skeleton className="h-6 w-20 rounded-full" />
            ) : serverError ? (
              <StatusBadge variant="failed" label="Nodes Offline" size="sm" />
            ) : (
              <StatusBadge
                variant={onlineServers > 0 ? "healthy" : "stopped"}
                label={`Nodes: ${onlineServers}/${totalServers}`}
                size="sm"
              />
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-muted-foreground">Time</span>
          <ServerTime />
        </div>
      </SheetFooter>
    </div>
  )
}

export function AppHeader() {
  const pathname = usePathname()
  const api = useApi()

  const [servers, setServers] = React.useState<Server[] | null>(null)
  const [loadingServers, setLoadingServers] = React.useState(true)
  const [serverError, setServerError] = React.useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const pageTitle = getPageTitle(pathname)

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = pageTitle
    }
  }, [pageTitle])

  React.useEffect(() => {
    let isMounted = true

    api.servers
      .list()
      .then((data) => {
        if (isMounted) {
          setServers(data)
          setLoadingServers(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setServerError(true)
          setLoadingServers(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [api])

  const segments = pathname.split("/").filter(Boolean)
  const showBreadcrumbs = segments.length > 0 && segments[0] !== "login"

  const totalServers = servers?.length ?? 0
  const onlineServers =
    servers?.filter((s) => s.status === "online").length ?? 0

  return (
    <>
      <title>{pageTitle}</title>
      <header className="sticky top-0 z-30 w-full border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-4 sm:px-6">
          {/* Left: Mobile Drawer Trigger + Brand + Desktop Horizontal Navigation */}
          <div className="flex min-w-0 items-center gap-3 sm:gap-4 lg:gap-6">
            {/* Mobile Menu Toggle (< md) */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border md:hidden"
                    aria-label="Open navigation menu"
                    data-testid="mobile-menu-trigger"
                  />
                }
              >
                <ListIcon className="size-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-72 flex-col justify-between border-r border-border p-0"
              >
                <MobileNavContent
                  pathname={pathname}
                  onClose={() => setMobileMenuOpen(false)}
                  servers={servers}
                  loadingServers={loadingServers}
                  serverError={serverError}
                />
              </SheetContent>
            </Sheet>

            {/* Brand Section */}
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2.5 rounded-md transition-opacity outline-none select-none hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Tako Control Plane"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-md border border-border bg-muted/30">
                <img
                  src="/icon.svg"
                  alt="Tako"
                  className="size-5 object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm leading-none font-semibold tracking-tight text-foreground">
                  Tako
                </span>
                <span className="mt-0.5 hidden font-mono text-[10px] leading-none text-muted-foreground sm:inline">
                  Control Plane
                </span>
              </div>
            </Link>

            <Separator
              orientation="vertical"
              className="my-auto hidden h-4 shrink-0 md:block"
            />

            {/* Desktop Horizontal Navigation Links (hidden md:flex) */}
            <nav
              className="hidden shrink-0 items-center gap-1 md:flex"
              aria-label="Main Navigation"
            >
              {navItems.map((item) => {
                const active = isRouteActive(pathname, item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-active={active ? "true" : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-muted/70 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <Icon
                      className="size-4 shrink-0"
                      weight="duotone"
                      aria-hidden="true"
                    />
                    <span>{item.title}</span>
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right Utilities */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Node Connectivity Pill */}
            <div
              data-testid="node-connectivity-pill"
              className="flex items-center"
            >
              {loadingServers ? (
                <Skeleton className="h-6 w-24 rounded-full" />
              ) : serverError ? (
                <StatusBadge variant="failed" label="Nodes Offline" size="sm" />
              ) : (
                <StatusBadge
                  variant={onlineServers > 0 ? "healthy" : "stopped"}
                  label={`Nodes: ${onlineServers}/${totalServers}`}
                  size="sm"
                />
              )}
            </div>

            <Separator
              orientation="vertical"
              className="my-auto hidden h-4 self-center sm:block"
            />

            {/* Server Time Display */}
            <div className="hidden sm:block">
              <ServerTime />
            </div>

            <Separator
              orientation="vertical"
              className="my-auto h-4 self-center"
            />

            {/* User Avatar Menu */}
            <NavUser />
          </div>
        </div>

        {/* Breadcrumb Sub-Header Integration for Nested Routes */}
        {showBreadcrumbs && (
          <div
            data-testid="breadcrumb-sub-header"
            className="border-t border-border/60 bg-muted/20"
          >
            <div className="mx-auto flex h-9 w-full max-w-screen-2xl items-center px-4 text-xs sm:px-6">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink render={<Link href="/" />}>
                      Tako
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {segments.map((segment, index) => {
                    const isLast = index === segments.length - 1
                    const path =
                      segment === "dashboard"
                        ? "/"
                        : `/${segments.slice(0, index + 1).join("/")}`
                    const label = formatSegmentLabel(segment)

                    return (
                      <React.Fragment key={path}>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          {isLast ? (
                            <BreadcrumbPage>{label}</BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink render={<Link href={path} />}>
                              {label}
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </React.Fragment>
                    )
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>
        )}
      </header>
    </>
  )
}
