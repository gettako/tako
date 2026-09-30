import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import ServiceLayout from "../(dashboard)/projects/[id]/services/[serviceId]/layout"
import { CreateProjectForm } from "@/components/projects/create-project-dialog"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme/services/srv_web_prod",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("Keyboard Accessibility and Focus Indicator Audit (M6-002)", () => {
  it("Button renders with visible 2px outline and offset on focus-visible", () => {
    const html = renderToString(<Button>Interactive Button</Button>)

    expect(html).toContain("focus-visible:ring-2")
    expect(html).toContain("focus-visible:ring-ring")
    expect(html).toContain("focus-visible:ring-offset-2")
  })

  it("Input renders with visible 2px outline and offset on focus-visible", () => {
    const html = renderToString(<Input placeholder="Enter value..." />)

    expect(html).toContain("focus-visible:ring-2")
    expect(html).toContain("focus-visible:ring-ring")
    expect(html).toContain("focus-visible:ring-offset-2")
  })

  it("ThemeToggle includes visible 2px focus ring and offset", () => {
    const html = renderToString(<ThemeToggle />)

    expect(html).toContain("focus-visible:ring-2")
    expect(html).toContain("focus-visible:ring-ring")
    expect(html).toContain("focus-visible:ring-offset-2")
  })

  it("ServiceTabs navigation links provide 2px focus outline with offset", () => {
    const html = renderToString(
      <ServiceLayout params={{ id: "prj_acme", serviceId: "srv_web_prod" }}>
        <div>Content</div>
      </ServiceLayout>
    )

    expect(html).toContain("focus-visible:ring-2")
    expect(html).toContain("focus-visible:ring-ring")
    expect(html).toContain("focus-visible:ring-offset-2")
  })

  it("Dialog forms render keyboard accessible buttons with distinct focus styles", () => {
    const html = renderToString(<CreateProjectForm onCancel={() => {}} />)

    expect(html).toContain("Create Project")
    expect(html).toContain("Cancel")
    expect(html).toContain("focus-visible:ring-2")
  })
})
