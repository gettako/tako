import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import ServiceMonitoringPage from "../page"
import { ServiceProvider } from "@/components/services/service-context"
import { ResourceChart } from "@/components/charts/resource-chart"
import { api, resetApiClient } from "@/lib/api"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme/services/srv_web_prod/monitoring",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("ServiceMonitoringPage (M4-006 & M14-006)", () => {
  it("renders ServiceMonitoringPage initial state without errors and zero em dashes", () => {
    const html = renderToString(
      <ServiceProvider serviceId="srv_web_prod" projectId="prj_acme">
        <ServiceMonitoringPage />
      </ServiceProvider>
    )

    expect(html).toBeDefined()
    expect(html).not.toContain("—")
  })

  it("renders ResourceChart with CPU, Memory, and Network I/O metrics cleanly with zero em dashes and zero shadows", () => {
    const chartHtml = renderToString(
      <div>
        <ResourceChart
          title="Container CPU Usage"
          currentValue="2.4%"
          unit="%"
          color="sky"
          data={[{ timestamp: new Date().toISOString(), value: 2.4 }]}
          timeRanges={["1h", "6h", "24h", "7d"]}
          selectedRange="1h"
        />
        <ResourceChart
          title="Container Memory Usage"
          currentValue="148 MB"
          unit=" MB"
          color="primary"
          data={[{ timestamp: new Date().toISOString(), value: 148 }]}
          timeRanges={["1h", "6h", "24h", "7d"]}
          selectedRange="1h"
        />
        <ResourceChart
          title="Network I/O Rate"
          currentValue="12.4 KB/s"
          unit=" KB/s"
          color="emerald"
          data={[{ timestamp: new Date().toISOString(), value: 12.4 }]}
          timeRanges={["1h", "6h", "24h", "7d"]}
          selectedRange="1h"
        />
      </div>
    )

    expect(chartHtml).toContain("Container CPU Usage")
    expect(chartHtml).toContain("Container Memory Usage")
    expect(chartHtml).toContain("Network I/O Rate")
    expect(chartHtml).toContain("1h")
    expect(chartHtml).toContain("6h")
    expect(chartHtml).toContain("24h")
    expect(chartHtml).toContain("7d")
    expect(chartHtml).not.toContain("—")
    expect(chartHtml).not.toContain("box-shadow")
  })

  it("fetches per-service historical metrics across selectable time windows", async () => {
    resetApiClient()

    // Test 1h range
    const m1h = await api.services.getMetrics("srv_web_prod", "1h")
    expect(m1h).toBeDefined()
    expect(m1h.service_id).toBe("srv_web_prod")
    expect(m1h.range).toBe("1h")
    expect(m1h.points.length).toBeGreaterThanOrEqual(10)
    expect(m1h.current).toBeDefined()
    expect(m1h.current.cpu_percent).toBeGreaterThanOrEqual(0)
    expect(m1h.current.memory_bytes).toBeGreaterThan(0)
    expect(m1h.current.network_rx_rate).toBeGreaterThanOrEqual(0)
    expect(m1h.current.restart_count).toBe(0)

    // Test 6h range
    const m6h = await api.services.getMetrics("srv_web_prod", "6h")
    expect(m6h.range).toBe("6h")
    expect(m6h.points.length).toBeGreaterThanOrEqual(10)

    // Test 24h range
    const m24h = await api.services.getMetrics("srv_web_prod", "24h")
    expect(m24h.range).toBe("24h")
    expect(m24h.points.length).toBeGreaterThanOrEqual(10)

    // Test 7d range
    const m7d = await api.services.getMetrics("srv_web_prod", "7d")
    expect(m7d.range).toBe("7d")
    expect(m7d.points.length).toBeGreaterThanOrEqual(10)
  })

  it("streams container runtime logs from MockApiClient", async () => {
    resetApiClient()

    const stream = api.services.streamContainerLogs("srv_web_prod", {
      tail: 50,
      follow: true,
    })

    const chunks = []
    for await (const chunk of stream) {
      chunks.push(chunk)
      if (chunks.length >= 5) break
    }

    expect(chunks.length).toBeGreaterThanOrEqual(5)
    expect(chunks[0].stream).toBeDefined()
    expect(chunks[0].line).toBeDefined()
  })
})
