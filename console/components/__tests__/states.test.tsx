import { describe, it, expect } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { EmptyState, LoadingSkeleton, ErrorCard } from "../states"
import { ApiError } from "@/lib/api/client"

describe("State Components", () => {
  describe("EmptyState", () => {
    it("renders title, description, and action button", () => {
      const html = renderToString(
        <EmptyState
          title="No services found"
          description="Create your first service to get started."
          action={{
            label: "Create Service",
            href: "/services/new",
          }}
        />
      )

      expect(html).toContain("No services found")
      expect(html).toContain("Create your first service to get started.")
      expect(html).toContain("Create Service")
      expect(html).toContain('href="/services/new"')
      expect(html).toContain("border-dashed")
    })

    it("renders custom icon element", () => {
      const html = renderToString(
        <EmptyState
          icon={<span data-testid="custom-icon">ICON</span>}
          title="Empty"
        />
      )
      expect(html).toContain('data-testid="custom-icon"')
    })
  })

  describe("LoadingSkeleton", () => {
    it("renders card skeleton variant", () => {
      const html = renderToString(<LoadingSkeleton variant="card" count={2} />)
      expect(html).toContain("animate-pulse")
      expect(html).toContain("grid")
    })

    it("renders table skeleton variant with specified rows", () => {
      const html = renderToString(<LoadingSkeleton variant="table" rows={3} />)
      expect(html).toContain("animate-pulse")
      expect(html).toContain("divide-y")
    })

    it("renders metrics skeleton variant", () => {
      const html = renderToString(
        <LoadingSkeleton variant="metrics" columns={3} />
      )
      expect(html).toContain("grid")
      expect(html).toContain("animate-pulse")
    })
  })

  describe("ErrorCard", () => {
    it("renders title, message, and error code", () => {
      const html = renderToString(
        <ErrorCard
          title="Connection Failure"
          message="Could not reach node agent"
          code="ERR_NETWORK"
          onRetry={() => {}}
        />
      )

      expect(html).toContain('role="alert"')
      expect(html).toContain("Connection Failure")
      expect(html).toContain("Could not reach node agent")
      expect(html).toContain("(ERR_NETWORK)")
      expect(html).toContain("Try again")
    })

    it("handles ApiError instance correctly", () => {
      const apiErr = new ApiError(404, "NOT_FOUND", "Project not found")
      const html = renderToString(<ErrorCard error={apiErr} />)

      expect(html).toContain("Project not found")
      expect(html).toContain("(NOT_FOUND)")
    })
  })
})
