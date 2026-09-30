import { describe, it, expect } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { StatusBadge, type StatusVariant } from "../status-badge"

describe("StatusBadge", () => {
  const variants: StatusVariant[] = [
    "running",
    "healthy",
    "online",
    "success",
    "building",
    "deploying",
    "failed",
    "error",
    "offline",
    "cancelled",
    "stopped",
    "inactive",
    "queued",
    "pending",
    "unhealthy",
  ]

  it("renders all variants without throwing", () => {
    for (const variant of variants) {
      const html = renderToString(<StatusBadge variant={variant} />)
      expect(html).toContain('role="status"')
      expect(html).toContain("rounded-full border")
    }
  })

  it("renders pulse animation dot for building state", () => {
    const html = renderToString(<StatusBadge variant="building" />)
    expect(html).toContain("animate-pulse")
  })

  it("respects custom label override", () => {
    const html = renderToString(
      <StatusBadge variant="running" label="Operational" />
    )
    expect(html).toContain("Operational")
  })

  it("supports sm and md sizes", () => {
    const smHtml = renderToString(<StatusBadge variant="running" size="sm" />)
    expect(smHtml).toContain("px-2 py-0.5")

    const mdHtml = renderToString(<StatusBadge variant="running" size="md" />)
    expect(mdHtml).toContain("px-2.5 py-1")
    expect(mdHtml).toContain("font-medium")
  })
})
