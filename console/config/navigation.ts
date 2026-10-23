import type { ComponentType } from "react"
import type { Route } from "next"
import {
  Activity,
  FolderGit2,
  LayoutDashboard,
  Radio,
  ScrollText,
  Server,
  Settings,
  User,
} from "lucide-react"

export interface NavigationItem {
  name: string
  href: Route
  icon: ComponentType<{ className?: string }>
  commandLabel?: string
  inSidebar?: boolean
}

export interface NavigationGroup {
  title: string
  items: NavigationItem[]
}

export const navigationGroups: NavigationGroup[] = [
  {
    title: "Platform",
    items: [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        commandLabel: "Dashboard Overview",
      },
      {
        name: "Projects",
        href: "/projects",
        icon: FolderGit2,
        commandLabel: "Projects & Services",
      },
      {
        name: "Live Traffic",
        href: "/live",
        icon: Radio,
        commandLabel: "Live Telemetry Traffic",
        inSidebar: false,
      },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      {
        name: "Nodes",
        href: "/nodes",
        icon: Server,
        commandLabel: "Cluster Nodes",
      },
      {
        name: "Monitoring",
        href: "/monitor",
        icon: Activity,
        commandLabel: "Cluster Monitoring",
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        name: "Logs",
        href: "/audit-logs",
        icon: ScrollText,
        commandLabel: "Audit Logs",
      },
      {
        name: "Settings",
        href: "/settings",
        icon: Settings,
        commandLabel: "Cluster Settings",
      },
      {
        name: "Profile",
        href: "/profile",
        icon: User,
        commandLabel: "User Profile & Security",
        inSidebar: false,
      },
    ],
  },
]

export const sidebarNavigationGroups: NavigationGroup[] = navigationGroups
  .map((group) => ({
    ...group,
    items: group.items.filter((item) => item.inSidebar !== false),
  }))
  .filter((group) => group.items.length > 0)
