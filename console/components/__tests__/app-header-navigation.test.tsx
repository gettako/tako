import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"

// Variable to control mocked pathname dynamically across test assertions
let currentPathname = "/projects"

mock.module("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

import { AppHeader, MobileNavContent, getPageTitle } from "../app-header"
import { NavUser } from "../nav-user"
import { Sheet } from "@/components/ui/sheet"
import DashboardLayout from "@/app/(dashboard)/layout"

describe("M17-001: Horizontal Top Header Navigation Migration", () => {
  describe("Dashboard Layout Shell", () => {
    it("renders boxed canvas with max-w-screen-2xl, AppHeader, and completely removes persistent sidebar", () => {
      currentPathname = "/"
      const html = renderToString(
        <DashboardLayout>
          <div data-testid="dashboard-content">Dashboard Content Canvas</div>
        </DashboardLayout>
      )

      // Main canvas is boxed with max-w-screen-2xl and proper overflow containment
      expect(html).toContain("max-w-screen-2xl")
      expect(html).toContain("mx-auto")
      expect(html).toContain("min-w-0")
      expect(html).toContain("overflow-x-hidden")
      expect(html).toContain("overflow-x-auto")
      expect(html).toContain('data-testid="dashboard-content"')

      // AppSidebar, SidebarProvider, and SidebarInset are not present
      expect(html).not.toContain('data-slot="sidebar"')
      expect(html).not.toContain('data-slot="sidebar-inset"')
      expect(html).not.toContain("group-data-[collapsible=icon]")
    })
  })

  describe("Primary Top Navigation Header (AppHeader)", () => {
    it("renders brand logo, brand title, horizontal navigation links, and omits documentation from top header bar", () => {
      currentPathname = "/"
      const html = renderToString(<AppHeader />)

      // Boxed container
      expect(html).toContain("max-w-screen-2xl")

      // Brand section
      expect(html).toContain("/icon.svg")
      expect(html).toContain("Tako")
      expect(html).toContain("Control Plane")

      // Horizontal navigation links
      expect(html).toContain("Dashboard")
      expect(html).toContain('href="/"')
      expect(html).toContain("Projects")
      expect(html).toContain('href="/projects"')
      expect(html).toContain("Servers")
      expect(html).toContain('href="/servers"')
      expect(html).toContain("Settings")
      expect(html).toContain('href="/settings"')

      // Documentation link removed from top header bar (present in avatar dropdown instead)
      expect(html).not.toContain('data-testid="docs-header-link"')
    })

    it("renders dynamic <title> 'Tako - [page]' for current pathname", () => {
      // 1. Root dashboard
      currentPathname = "/"
      const rootHtml = renderToString(<AppHeader />)
      expect(rootHtml).toContain("<title>Tako - Dashboard</title>")
      expect(getPageTitle("/")).toBe("Tako - Dashboard")
      expect(getPageTitle("/dashboard")).toBe("Tako - Dashboard")

      // 2. Projects
      currentPathname = "/projects"
      const projectsHtml = renderToString(<AppHeader />)
      expect(projectsHtml).toContain("<title>Tako - Projects</title>")
      expect(getPageTitle("/projects")).toBe("Tako - Projects")

      // 3. Servers
      currentPathname = "/servers"
      const serversHtml = renderToString(<AppHeader />)
      expect(serversHtml).toContain("<title>Tako - Servers</title>")
      expect(getPageTitle("/servers")).toBe("Tako - Servers")

      // 4. Settings & nested
      currentPathname = "/settings"
      const settingsHtml = renderToString(<AppHeader />)
      expect(settingsHtml).toContain("<title>Tako - Settings</title>")
      expect(getPageTitle("/settings")).toBe("Tako - Settings")
      expect(getPageTitle("/settings/security")).toBe("Tako - Security")
      expect(getPageTitle("/settings/audit")).toBe("Tako - Audit Log")
      expect(getPageTitle("/profile")).toBe("Tako - Profile")
    })

    it("marks active route indicator correctly without full page reload", () => {
      // 1. When on /projects
      currentPathname = "/projects"
      const projectsHtml = renderToString(<AppHeader />)
      expect(projectsHtml).toContain('data-active="true"')
      expect(projectsHtml).toContain('aria-current="page"')

      // 2. When on /servers
      currentPathname = "/servers"
      const serversHtml = renderToString(<AppHeader />)
      expect(serversHtml).toContain('href="/servers"')
      expect(serversHtml).toContain('data-active="true"')

      // 3. When on /settings
      currentPathname = "/settings"
      const settingsHtml = renderToString(<AppHeader />)
      expect(settingsHtml).toContain('href="/settings"')
      expect(settingsHtml).toContain('data-active="true"')
    })

    it("renders node connectivity pill and server time display on the right", () => {
      currentPathname = "/projects"
      const html = renderToString(<AppHeader />)

      expect(html).toContain('data-testid="node-connectivity-pill"')
      expect(html).toContain('data-testid="server-time"')
      expect(html).toContain("Server Time (UTC)")
    })

    it("renders contextual breadcrumbs for nested routes cleanly in boxed sub-header strip", () => {
      // Nested project service route
      currentPathname = "/projects/prj_acme/services/srv_api"
      const html = renderToString(<AppHeader />)

      expect(html).toContain('data-testid="breadcrumb-sub-header"')
      expect(html).toContain('aria-label="breadcrumb"')
      expect(html).toContain("Projects")
      expect(html).toContain("prj_acme")
      expect(html).toContain("Services")
      expect(html).toContain("srv_api")

      // Root dashboard should not display redundant breadcrumb sub-header
      currentPathname = "/"
      const rootHtml = renderToString(<AppHeader />)
      expect(rootHtml).not.toContain('data-testid="breadcrumb-sub-header"')
    })

    it("renders mobile hamburger button and mobile drawer navigation with at least 44px tap targets", () => {
      currentPathname = "/servers"
      const html = renderToString(<AppHeader />)

      // Mobile hamburger trigger button
      expect(html).toContain('data-testid="mobile-menu-trigger"')
      expect(html).toContain("size-10")

      // Mobile navigation drawer content
      const drawerHtml = renderToString(
        <Sheet>
          <MobileNavContent pathname="/servers" />
        </Sheet>
      )

      // Mobile navigation items adhere to 44px height (h-11)
      expect(drawerHtml).toContain("h-11")
      expect(drawerHtml).toContain("Tako Control Plane")
      expect(drawerHtml).toContain("Documentation")
      expect(drawerHtml).toContain('href="/servers"')
      expect(drawerHtml).toContain('data-active="true"')
    })

    it("adheres strictly to flat theme with zero shadows", () => {
      currentPathname = "/projects"
      const html = renderToString(<AppHeader />)

      expect(html).not.toContain("shadow-sm")
      expect(html).not.toContain("shadow-md")
      expect(html).not.toContain("shadow-lg")
      expect(html).not.toContain("shadow-xl")
      expect(html).not.toContain("shadow-2xl")
    })
  })

  describe("Decoupled User Menu (NavUser)", () => {
    it("renders standalone avatar button, user metadata, and documentation link without sidebar dependency", () => {
      const html = renderToString(
        <NavUser
          user={{
            name: "Admin",
            email: "admin@tako.local",
          }}
        />
      )

      expect(html).toContain('data-testid="nav-user-trigger"')
      expect(html).toContain("Admin")
      expect(html).toContain("admin@tako.local")
      expect(html).toContain("User account menu for Admin")
    })
  })
})
