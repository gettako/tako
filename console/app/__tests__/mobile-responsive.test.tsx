import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import DashboardLayout from "../(dashboard)/layout"
import { AppHeader } from "@/components/app-header"
import { ThemeToggle } from "@/components/theme-toggle"
import { LogViewer } from "@/components/log-viewer"
import { SidebarProvider } from "@/components/ui/sidebar"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("Mobile Responsive and Touch Target Audit (M6-001)", () => {
  it("verifies DashboardLayout contains min-w-0 and overflow containment to prevent window overflow", () => {
    const html = renderToString(
      <DashboardLayout>
        <div id="content">Dashboard Content</div>
      </DashboardLayout>
    )

    // Verify SidebarInset contains min-w-0 and overflow-x-hidden
    expect(html).toContain("min-w-0")
    expect(html).toContain("overflow-x-hidden")
    // Verify main has min-w-0 and overflow-x-auto
    expect(html).toContain("overflow-x-auto")
  })

  it("verifies AppHeader interactive elements adhere to max height h-10/size-10", () => {
    const html = renderToString(
      <SidebarProvider>
        <AppHeader />
      </SidebarProvider>
    )

    // Sidebar trigger has size-10
    expect(html).toContain("size-10")
  })

  it("verifies ThemeToggle component provides size-10 tap target without arbitrary sizing", () => {
    const html = renderToString(<ThemeToggle />)
    expect(html).toContain("size-10")
    expect(html).toContain("sm:size-9")
    expect(html).not.toContain("min-h-[44px]")
    expect(html).not.toContain("min-w-[44px]")
  })

  it("verifies LogViewer viewport has internal scrolling with overflow-auto", () => {
    const html = renderToString(
      <LogViewer
        logs={[
          "Starting deployment for service srv_test...",
          "Building Dockerfile layers step 1/5...",
        ]}
      />
    )

    expect(html).toContain("overflow-auto")
  })
})
