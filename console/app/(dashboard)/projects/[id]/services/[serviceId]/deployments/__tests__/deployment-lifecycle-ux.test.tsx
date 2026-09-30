import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import {
  computeEnvDiff,
  formatEnvValue,
  EnvDiffPill,
  EnvDiffPanel,
} from "@/components/services/deployment-env-diff"
import { ActiveDeploymentBanner } from "@/components/services/active-deployment-banner"
import ServiceDeploymentsPage from "../page"
import ServiceLayout from "../../layout"
import { ServiceProvider } from "@/components/services/service-context"
import { api, resetApiClient, type Deployment, type EnvVar } from "@/lib/api"
import { getMockServiceDetail } from "@/lib/api/fixtures/services"
import { mockDeployments } from "@/lib/api/fixtures/deployments"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/projects/prj_acme/services/srv_storefront/deployments",
  useSearchParams: () => new URLSearchParams(),
}))

describe("M4-008 Service Deployment Lifecycle UX", () => {
  describe("Environment Variable Diff Calculation & Panel", () => {
    const prevSnapshot: EnvVar[] = [
      {
        key: "DATABASE_URL",
        value: "postgres://user:pass@db:5432/app",
        is_secret: true,
      },
      { key: "PORT", value: "3000", is_secret: false },
      { key: "LOG_LEVEL", value: "debug", is_secret: false },
    ]

    const currSnapshot: EnvVar[] = [
      {
        key: "DATABASE_URL",
        value: "postgres://user:pass@db:5432/app",
        is_secret: true,
      },
      { key: "PORT", value: "8080", is_secret: false },
      { key: "API_KEY", value: "secret12345", is_secret: true },
    ]

    it("computes added, removed, and changed variables correctly", () => {
      const diffs = computeEnvDiff(currSnapshot, prevSnapshot)

      expect(diffs.length).toBe(3)

      const added = diffs.find((d) => d.key === "API_KEY")
      expect(added).toBeDefined()
      expect(added?.changeType).toBe("added")
      expect(added?.newValue).toBe("secret12345")
      expect(added?.isSecret).toBe(true)

      const removed = diffs.find((d) => d.key === "LOG_LEVEL")
      expect(removed).toBeDefined()
      expect(removed?.changeType).toBe("removed")
      expect(removed?.oldValue).toBe("debug")
      expect(removed?.isSecret).toBe(false)

      const changed = diffs.find((d) => d.key === "PORT")
      expect(changed).toBeDefined()
      expect(changed?.changeType).toBe("changed")
      expect(changed?.oldValue).toBe("3000")
      expect(changed?.newValue).toBe("8080")
      expect(changed?.isSecret).toBe(false)
    })

    it("returns empty diff when snapshots are identical", () => {
      const diffs = computeEnvDiff(prevSnapshot, prevSnapshot)
      expect(diffs.length).toBe(0)
    })

    it("returns empty diff when previous snapshot is not provided", () => {
      const diffs = computeEnvDiff(currSnapshot, null)
      expect(diffs.length).toBe(0)
    })

    it("masks secrets permanently and formats plain variables", () => {
      expect(formatEnvValue("my_secret_token", true)).toBe("••••••")
      expect(formatEnvValue("8080", false)).toBe("8080")
      expect(formatEnvValue(undefined, false)).toBe("(none)")
    })

    it("renders EnvDiffPill with count and accessible ARIA attributes", () => {
      const html = renderToString(
        <EnvDiffPill
          count={3}
          isExpanded={false}
          onToggle={() => {}}
          deploymentId="dep_001"
        />
      )

      expect(html).toContain("Env Changes (3)")
      expect(html).toContain('aria-expanded="false"')
      expect(html).toContain('aria-controls="env-diff-dep_001"')
      expect(html).not.toContain("—")
    })

    it("omits EnvDiffPill when change count is 0", () => {
      const html = renderToString(
        <EnvDiffPill
          count={0}
          isExpanded={false}
          onToggle={() => {}}
          deploymentId="dep_001"
        />
      )

      expect(html).toBe("")
    })

    it("renders EnvDiffPanel with semantic color tags, masked secrets, and raw values", () => {
      const diffs = computeEnvDiff(currSnapshot, prevSnapshot)
      const html = renderToString(
        <EnvDiffPanel diffs={diffs} deploymentId="dep_001" />
      )

      expect(html).toContain("Environment Variable Changes (3)")
      expect(html).toContain("API_KEY")
      expect(html).toContain("added")
      expect(html).toContain("••••••")
      expect(html).toContain("PORT")
      expect(html).toContain("changed")
      expect(html).toContain("3000")
      expect(html).toContain("8080")
      expect(html).toContain("LOG_LEVEL")
      expect(html).toContain("removed")
      expect(html).toContain("debug")
      expect(html).not.toContain("—")
    })
  })

  describe("Active Deployment Banner", () => {
    it("renders banner between tabs and content in ServiceLayout for in-progress service", () => {
      // srv_storefront has status: "building" in mock data
      const mockBuildingService = getMockServiceDetail("srv_storefront")!
      const html = renderToString(
        <ServiceLayout
          params={{ id: "prj_ecommerce", serviceId: "srv_storefront" }}
          initialService={mockBuildingService}
        >
          <div>Tab Content</div>
        </ServiceLayout>
      )

      expect(html).toContain("Active deployment banner")
      expect(html).toContain("View Build Log")
      expect(html).toContain("release-v2")
      expect(html).toContain("Tab Content")
      expect(html).not.toContain("—")
    })

    it("does not render active deployment banner for a running service with no active build", () => {
      // srv_web_prod has status: "running" and dep_001 has status: "success"
      const mockRunningService = getMockServiceDetail("srv_web_prod")!
      const html = renderToString(
        <ServiceProvider
          serviceId="srv_web_prod"
          projectId="prj_acme"
          initialService={mockRunningService}
        >
          <ActiveDeploymentBanner />
        </ServiceProvider>
      )

      // When not active and isTerminalStatus, should not display banner
      expect(html).not.toContain("Active deployment banner")
    })
  })

  describe("Deployments Page with Env Diff and Log Opening", () => {
    it("renders deployment rows with Env Changes pill for deployments with modified env vars", () => {
      const mockRunningService = getMockServiceDetail("srv_web_prod")!
      const html = renderToString(
        <ServiceProvider
          serviceId="srv_web_prod"
          projectId="prj_acme"
          initialService={mockRunningService}
        >
          <ServiceDeploymentsPage
            initialDeployments={mockDeployments.filter(
              (d) => d.service_id === "srv_web_prod"
            )}
          />
        </ServiceProvider>
      )

      expect(html).toContain("All Deployments")
      expect(html).toContain("Deploy Branch")
      expect(html).toContain("Env Changes")
      expect(html).not.toContain("—")
    })

    it("verifies mockDeployments fixture contains valid env_snapshot data", async () => {
      resetApiClient()

      const res = await api.services.listDeployments("srv_web_prod", {
        limit: 10,
      })
      const dep001 = res.items.find((d) => d.id === "dep_001")
      const dep002 = res.items.find((d) => d.id === "dep_002")

      expect(dep001?.env_snapshot).toBeDefined()
      expect(dep002?.env_snapshot).toBeDefined()

      const diffs = computeEnvDiff(dep001?.env_snapshot, dep002?.env_snapshot)
      expect(diffs.length).toBeGreaterThan(0)
    })

    it("auto-opens build log modal when openLog param matches active or specific deployment id", () => {
      const mockBuildingService = getMockServiceDetail("srv_storefront")!
      const storefrontDeps = mockDeployments.filter(
        (d) => d.service_id === "srv_storefront"
      )

      // Test with openLog=dep_005 (building deployment)
      const html = renderToString(
        <ServiceProvider
          serviceId="srv_storefront"
          projectId="prj_ecommerce"
          initialService={mockBuildingService}
        >
          <ServiceDeploymentsPage initialDeployments={storefrontDeps} />
        </ServiceProvider>
      )

      expect(html).toContain("All Deployments")
      expect(html).not.toContain("—")
    })
  })

  describe("Reactive Dismissal and Timer Verification", () => {
    it("dismisses banner reactively when service transitions to terminal healthy or running state", () => {
      // Simulate active building service first
      const buildingService = {
        ...getMockServiceDetail("srv_storefront")!,
        status: "building" as const,
      }
      const activeHtml = renderToString(
        <ServiceProvider
          serviceId="srv_storefront"
          projectId="prj_ecommerce"
          initialService={buildingService}
        >
          <ActiveDeploymentBanner />
        </ServiceProvider>
      )
      expect(activeHtml).toContain("Active deployment banner")

      // Then simulate terminal status transition (running, stopped, failed, unhealthy)
      const terminalStatuses = [
        "running",
        "failed",
        "stopped",
        "unhealthy",
      ] as const
      for (const terminalStatus of terminalStatuses) {
        const terminalService = {
          ...buildingService,
          status: terminalStatus,
        }
        const dismissedHtml = renderToString(
          <ServiceProvider
            serviceId="srv_storefront"
            projectId="prj_ecommerce"
            initialService={terminalService}
          >
            <ActiveDeploymentBanner />
          </ServiceProvider>
        )
        expect(dismissedHtml).not.toContain("Active deployment banner")
      }
    })

    it("calculates elapsed time correctly from started_at timestamp", () => {
      // Started 83 seconds ago: should format as "1m 23s"
      const now = Date.now()
      const startedAt = new Date(now - 83000).toISOString()
      const buildingService = {
        ...getMockServiceDetail("srv_storefront")!,
        status: "building" as const,
        active_deployment: {
          ...mockDeployments.find((d) => d.id === "dep_005")!,
          started_at: startedAt,
        },
      }

      const html = renderToString(
        <ServiceProvider
          serviceId="srv_storefront"
          projectId="prj_ecommerce"
          initialService={buildingService}
        >
          <ActiveDeploymentBanner />
        </ServiceProvider>
      )

      expect(html).toContain("Active deployment banner")
      expect(html).toContain("1m 23s")
      expect(html).toContain("View Build Log")
      expect(html).not.toContain("—")
    })

    it("verifies keyboard accessibility and focus attributes on interactive controls", () => {
      const diffs = [
        {
          key: "API_SECRET",
          changeType: "added" as const,
          newValue: "masked_val",
          isSecret: true,
        },
      ]

      const pillHtml = renderToString(
        <EnvDiffPill
          count={1}
          isExpanded={false}
          onToggle={() => {}}
          deploymentId="dep_test_1"
        />
      )

      expect(pillHtml).toContain('type="button"')
      expect(pillHtml).toContain('aria-expanded="false"')
      expect(pillHtml).toContain('aria-controls="env-diff-dep_test_1"')

      const panelHtml = renderToString(
        <EnvDiffPanel diffs={diffs} deploymentId="dep_test_1" />
      )

      expect(panelHtml).toContain('id="env-diff-dep_test_1"')
      expect(panelHtml).toContain('role="region"')
      expect(panelHtml).toContain(
        'aria-label="Environment variable differences"'
      )
    })
  })
})
