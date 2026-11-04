import { describe, expect, test } from "bun:test"
import { navigationGroups } from "@/config/navigation"

describe("Dashboard Navigation & Monitoring Targets", () => {
  test("navigation items include monitor and live traffic routes", () => {
    const platformGroup = navigationGroups.find((g) => g.title === "Platform")
    const infraGroup = navigationGroups.find((g) => g.title === "Infrastructure")

    expect(platformGroup).toBeDefined()
    expect(infraGroup).toBeDefined()

    const liveItem = platformGroup?.items.find((i) => i.href === "/live")
    expect(liveItem).toBeDefined()
    expect(liveItem?.name).toBe("Live Traffic")

    const monitorItem = infraGroup?.items.find((i) => i.href === "/monitor")
    expect(monitorItem).toBeDefined()
    expect(monitorItem?.name).toBe("Monitoring")
  })

  test("dashboard view exports valid component function", async () => {
    const { DashboardView } = await import("@/components/dashboard/dashboard-view")
    expect(typeof DashboardView).toBe("function")
  })
})
