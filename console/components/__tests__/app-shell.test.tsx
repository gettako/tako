import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { AppSidebar } from "../app-sidebar"
import { AppHeader } from "../app-header"
import { NavUser } from "../nav-user"
import { SidebarProvider } from "../ui/sidebar"
import { getDiceBearAvatar } from "@/lib/utils"

// Mock next/navigation
mock.module("next/navigation", () => ({
  usePathname: () => "/projects",
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("App Shell Components", () => {
  describe("AppSidebar", () => {
    it("renders navigation links for Projects, Servers, Settings, and Docs", () => {
      const html = renderToString(
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      )

      expect(html).toContain("Projects")
      expect(html).toContain("Servers")
      expect(html).toContain("Settings")
      expect(html).toContain("Documentation")
      expect(html).toContain('href="https://github.com/gettako/tako"')
      expect(html).toContain('href="/projects"')
      expect(html).toContain("Tako Control Plane")
      expect(html).toContain("Admin")
      expect(html).toContain("admin@tako.local")

      // Redundant mock project group removed from sidebar
      expect(html).not.toContain("api-gateway")
      expect(html).not.toContain("worker-queue")
    })

    it("marks active link matching current pathname", () => {
      const html = renderToString(
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      )

      // Projects is active because usePathname returns /projects
      expect(html).toContain('data-active="true"')
    })

    it("generates consistent DiceBear avatar URL from user email seed", () => {
      const avatarUrl = getDiceBearAvatar("admin@tako.local")
      expect(avatarUrl).toStartWith(
        "https://api.dicebear.com/10.x/big-smile/png?seed="
      )
      expect(avatarUrl).toBe(getDiceBearAvatar("admin@tako.local"))
      expect(getDiceBearAvatar("user@example.com")).not.toBe(avatarUrl)
    })
  })

  describe("AppHeader", () => {
    it("renders dynamic breadcrumbs, node pill, and server time without admin owner", () => {
      const html = renderToString(
        <SidebarProvider>
          <AppHeader />
        </SidebarProvider>
      )

      expect(html).toContain('aria-label="breadcrumb"')
      expect(html).toContain("Projects")
      expect(html).toContain('data-testid="node-connectivity-pill"')
      expect(html).toContain('data-testid="server-time"')
      expect(html).not.toContain('data-testid="user-profile-button"')
    })
  })

  describe("NavUser", () => {
    it("renders user name and email in trigger", () => {
      const html = renderToString(
        <SidebarProvider>
          <NavUser
            user={{
              name: "Admin",
              email: "admin@tako.local",
            }}
          />
        </SidebarProvider>
      )

      expect(html).toContain("Admin")
      expect(html).toContain("admin@tako.local")
    })
  })
})
