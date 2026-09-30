import { describe, it, expect } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import { LogViewer } from "../log-viewer"
import type { BuildLogStreamEvent, ContainerLogEvent } from "@/lib/api"

describe("LogViewer", () => {
  it("renders empty state when no logs are provided", () => {
    const html = renderToString(
      <LogViewer logs={[]} emptyMessage="Waiting for output..." />
    )

    expect(html).toContain("Waiting for output...")
    expect(html).toContain("0 lines")
    expect(html).toContain('data-slot="log-viewer"')
  })

  it("renders loading skeleton when isLoading is true and logs are empty", () => {
    const html = renderToString(<LogViewer logs={[]} isLoading />)

    expect(html).toContain("animate-pulse")
  })

  it("renders log lines sequentially with line numbers and stream distinction", () => {
    const logs: Array<string | BuildLogStreamEvent | ContainerLogEvent> = [
      "Plain log line 1",
      {
        event: "build_step",
        step: "1/4",
        title: "FROM node:20-alpine",
        status: "running",
      },
      {
        event: "build_log",
        stream: "stderr",
        line: "Warning: deprecated package detected",
        timestamp: "2026-09-28T12:00:00.000Z",
      },
      {
        container_id: "cnt_123",
        stream: "stdout",
        line: "Server running at http://localhost:3000",
        timestamp: "2026-09-28T12:00:01.000Z",
      },
      {
        event: "build_complete",
        status: "success",
        duration_seconds: 42,
        image_tag: "tako-srv:v1",
      },
    ]

    const html = renderToString(<LogViewer logs={logs} title="Build Stream" />)

    expect(html).toContain("Build Stream")
    expect(html).toContain("5 lines")
    expect(html).toContain("Plain log line 1")
    expect(html).toContain("Step 1/4: FROM node:20-alpine (running)")
    expect(html).toContain("Warning: deprecated package detected")
    expect(html).toContain("Server running at http://localhost:3000")
    expect(html).toContain("Build completed successfully in 42s (tako-srv:v1)")
    expect(html).toContain("text-sky-400")
    expect(html).toContain("text-red-400")
    expect(html).toContain("text-emerald-400")
  })

  it("does not contain em dashes", () => {
    const logs = ["Step 1: starting task", "Process completed"]
    const html = renderToString(<LogViewer logs={logs} />)
    expect(html).not.toContain("—")
  })

  it("renders toolbar controls: Pause, Copy, and Clear buttons", () => {
    const html = renderToString(<LogViewer logs={["sample"]} />)

    expect(html).toContain("Pause")
    expect(html).toContain("Copy")
    expect(html).toContain("Clear")
    expect(html).toContain("Filter logs... (Ctrl+F)")
  })

  describe("M4-009 Regex Search Toggle", () => {
    it("renders regex toggle button with accessible aria attributes in plain inactive mode", () => {
      const html = renderToString(<LogViewer logs={["log line 1"]} />)

      expect(html).toContain(".*")
      expect(html).toContain('aria-label="Toggle regex search"')
      expect(html).toContain('aria-pressed="false"')
      expect(html).toContain("border-border focus:border-ring")
      expect(html).not.toContain("Invalid regex")
    })

    it("renders active indicator when regex mode is enabled", () => {
      const html = renderToString(
        <LogViewer logs={["log line 1"]} initialRegexMode={true} />
      )

      expect(html).toContain('aria-pressed="true"')
      expect(html).toContain("border-status-building-border")
      expect(html).toContain("bg-status-building-bg")
      expect(html).toContain("text-status-building-text")
    })

    it("filters lines and highlights matched segments with valid regex pattern", () => {
      const logs = [
        "Server listening on port 8080",
        "Failed to load cache",
        "Worker listening on port 3000",
      ]

      const html = renderToString(
        <LogViewer
          logs={logs}
          initialRegexMode={true}
          initialSearchQuery="port [0-9]+"
        />
      )

      expect(html).toContain("2 of 3 lines")
      expect(html).toContain("Server listening on")
      expect(html).toContain("Worker listening on")
      expect(html).not.toContain("Failed to load cache")
      expect(html).toContain("<mark")
      expect(html).toContain("bg-yellow-200/60")
      expect(html).toContain("dark:bg-yellow-400/20")
      expect(html).toContain("text-inherit")
      expect(html).toContain(">port 8080</mark>")
      expect(html).toContain(">port 3000</mark>")
    })

    it("displays inline error hint and error border on invalid regex without crashing", () => {
      const logs = ["line 1", "line 2"]

      const html = renderToString(
        <LogViewer
          logs={logs}
          initialRegexMode={true}
          initialSearchQuery="[invalid(regex"
        />
      )

      expect(html).toContain("Invalid regex")
      expect(html).toContain("border-status-error-border")
      expect(html).toContain('aria-invalid="true"')
      expect(html).toContain("text-status-error-text")
      expect(html).toContain("line 1")
      expect(html).toContain("line 2")
    })

    it("performs literal substring match when regex mode is inactive", () => {
      const logs = ["Item cost is $10.00 (special)", "Item cost is $20.00"]

      const html = renderToString(
        <LogViewer
          logs={logs}
          initialRegexMode={false}
          initialSearchQuery="$10.00 (special)"
        />
      )

      expect(html).toContain("1 of 2 lines")
      expect(html).toContain("Item cost is")
      expect(html).toContain(">$10.00 (special)</mark>")
      expect(html).not.toContain("Item cost is $20.00")
      expect(html).not.toContain("Invalid regex")
    })

    it("ensures regex toggle is keyboard accessible and follows flat design with zero shadows", () => {
      const html = renderToString(<LogViewer logs={["test line"]} />)

      expect(html).toContain('type="button"')
      expect(html).toContain("focus-visible:ring-2")
      expect(html).toContain("focus-visible:ring-ring")
      expect(html).not.toContain("shadow-sm")
      expect(html).not.toContain("shadow-md")
      expect(html).not.toContain("shadow-lg")
    })
  })
})
