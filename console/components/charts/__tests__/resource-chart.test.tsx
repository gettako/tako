import { describe, test, expect } from "bun:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ResourceChart } from "../resource-chart"
import { generateTelemetryHistory } from "../telemetry-utils"

describe("ResourceChart Component & Telemetry Generator", () => {
  test("generates realistic historical telemetry points", () => {
    const points = generateTelemetryHistory(25, 10, 60, 4, 0, 100)
    expect(points.length).toBe(10)
    expect(points[points.length - 1].value).toBe(25)
    points.forEach((p) => {
      expect(p.value).toBeGreaterThanOrEqual(0)
      expect(p.value).toBeLessThanOrEqual(100)
      expect(p.timestamp).toMatch(/^\d{2}:\d{2}$/)
    })
  })

  test("renders ResourceChart with SVG paths, titles, and time ranges without em dashes", () => {
    const data = [
      { timestamp: "10:00", value: 12 },
      { timestamp: "10:15", value: 24 },
      { timestamp: "10:30", value: 18 },
      { timestamp: "10:45", value: 30 },
    ]

    const html = renderToStaticMarkup(
      <ResourceChart
        title="CPU Utilization History"
        currentValue="30.0%"
        unit="%"
        color="sky"
        data={data}
        peakValue="45.0%"
        avgValue="21.0%"
      />
    )

    expect(html).toContain("CPU Utilization History")
    expect(html).toContain("30.0%")
    expect(html).toContain("<svg")
    expect(html).toContain('preserveAspectRatio="none"')
    expect(html).toContain('stroke-width="1.5"')
    expect(html).toContain("<path")
    expect(html).toContain(" C ")
    expect(html).toContain("15m")
    expect(html).toContain("1h")
    expect(html).toContain("6h")
    expect(html).toContain("24h")
    expect(html).not.toContain("—")
  })
})
