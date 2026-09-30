import { describe, it, expect, mock } from "bun:test"
import * as fs from "fs"
import * as path from "path"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { EmptyState } from "@/components/states/empty-state"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import { ErrorCard } from "@/components/states/error-card"

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

function getSourceFiles(dir: string): string[] {
  let results: string[] = []
  const list = fs.readdirSync(dir)
  for (const file of list) {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat && stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== "__tests__") {
        results = results.concat(getSourceFiles(filePath))
      }
    } else {
      if (file.endsWith(".tsx") || file.endsWith(".ts")) {
        results.push(filePath)
      }
    }
  }
  return results
}

describe("Antislop Copywriting and State Resilience Audit (M6-005)", () => {
  it("verifies zero em dashes (—) across all application source files", () => {
    const appDir = path.resolve(import.meta.dir, "..")
    const componentsDir = path.resolve(import.meta.dir, "../../components")
    const allFiles = [
      ...getSourceFiles(appDir),
      ...getSourceFiles(componentsDir),
    ]

    const emDashViolations: { file: string; line: number }[] = []

    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf-8")
      const lines = content.split("\n")
      lines.forEach((line, index) => {
        if (line.includes("—")) {
          emDashViolations.push({ file, line: index + 1 })
        }
      })
    }

    expect(emDashViolations).toEqual([])
  })

  it("verifies zero AI marketing buzzwords across all application source files", () => {
    const appDir = path.resolve(import.meta.dir, "..")
    const componentsDir = path.resolve(import.meta.dir, "../../components")
    const allFiles = [
      ...getSourceFiles(appDir),
      ...getSourceFiles(componentsDir),
    ]

    const buzzwords = [
      /\bseamless\b/i,
      /\bcutting-edge\b/i,
      /\brevolutionary\b/i,
      /\bai-powered\b/i,
      /\bmagic\b/i,
      /\beffortless\b/i,
    ]

    const buzzwordViolations: { file: string; word: string }[] = []

    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf-8")
      for (const pattern of buzzwords) {
        if (pattern.test(content)) {
          buzzwordViolations.push({ file, word: pattern.source })
        }
      }
    }

    expect(buzzwordViolations).toEqual([])
  })

  it("renders EmptyState component with action button and clear description", () => {
    const html = renderToString(
      <EmptyState
        title="No Services Found"
        description="Create your first web service to begin deployment."
        action={{
          label: "Create Service",
          onClick: () => {},
        }}
      />
    )

    expect(html).toContain("No Services Found")
    expect(html).toContain("Create your first web service to begin deployment.")
    expect(html).toContain("Create Service")
    expect(html).not.toContain("—")
  })

  it("renders LoadingSkeleton component cleanly with table and card variants", () => {
    const cardSkeleton = renderToString(<LoadingSkeleton variant="card" />)
    expect(cardSkeleton).toContain("animate-pulse")

    const tableSkeleton = renderToString(
      <LoadingSkeleton variant="table" rows={3} />
    )
    expect(tableSkeleton).toContain("animate-pulse")
  })

  it("renders ErrorCard component with retry button and error details", () => {
    const html = renderToString(
      <ErrorCard
        title="Connection Timed Out"
        message="Failed to contact agent daemon on port 50051."
        onRetry={() => {}}
      />
    )

    expect(html).toContain("Connection Timed Out")
    expect(html).toContain("Failed to contact agent daemon on port 50051.")
    expect(html).toContain("Try again")
    expect(html).not.toContain("—")
  })
})
