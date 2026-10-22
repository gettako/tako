import { describe, expect, it } from "bun:test"
import {
  adaptDeployment,
  adaptNode,
  adaptProject,
  adaptService,
  formatDuration,
  formatRelativeTime,
} from "../lib/adapters"
import type { ApiNode, ApiProject, ApiService } from "../lib/api"

describe("Format Utilities", () => {
  it("formats relative time correctly", () => {
    expect(formatRelativeTime(null)).toBe("Never")
    expect(formatRelativeTime("invalid-date")).toBe("Unknown")
    const now = new Date().toISOString()
    expect(formatRelativeTime(now)).toBe("Just now")
  })

  it("formats durations accurately", () => {
    expect(formatDuration(undefined)).toBe("—")
    expect(formatDuration(0)).toBe("—")
    expect(formatDuration(450)).toBe("450ms")
    expect(formatDuration(12500)).toBe("12.5s")
    expect(formatDuration(95000)).toBe("1m 35s")
  })
})

describe("Data Adapters", () => {
  it("adapts ApiNode with accurate resource percentages", () => {
    const rawNode: ApiNode = {
      id: "node-1",
      name: "edge-node-01",
      ipAddress: "192.168.1.100",
      role: "leader",
      status: "online",
      cpuTotalCores: 8,
      memoryTotalMb: 16384,
      diskTotalGb: 500,
      usage: {
        cpuPercent: 24.5,
        memoryUsedMb: 8192,
        memoryLimitMb: 16384,
        diskUsedGb: 125,
      },
      servicesCount: 4,
      agentConnected: true,
      dockerVersion: "26.1.1",
      os: "Linux",
      uptime: "14 days",
      lastHeartbeat: new Date().toISOString(),
    }

    const adapted = adaptNode(rawNode)
    expect(adapted.id).toBe("node-1")
    expect(adapted.role).toBe("master")
    expect(adapted.status).toBe("online")
    expect(adapted.cpuPercent).toBe(24.5)
    expect(adapted.memoryPercent).toBe(50) // 8192 / 16384 * 100
    expect(adapted.diskPercent).toBe(25) // 125 / 500 * 100
    expect(adapted.totalMemoryGb).toBe(16)
  })

  it("adapts ApiProject with valid environment fallback", () => {
    const rawProject: ApiProject = {
      id: "proj-1",
      name: "Production API",
      slug: "prod-api",
      description: "Main production backend",
      environment: "production",
      status: "active",
      tags: ["backend"],
      servicesCount: 3,
      healthyServicesCount: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const adapted = adaptProject(rawProject)
    expect(adapted.id).toBe("proj-1")
    expect(adapted.name).toBe("Production API")
    expect(adapted.environment).toBe("production")
    expect(adapted.servicesCount).toBe(3)
  })

  it("adapts ApiService and normalizes ports and metrics", () => {
    const rawService: ApiService = {
      id: "srv-1",
      projectId: "proj-1",
      nodeId: "node-1",
      name: "Web API",
      slug: "web-api",
      type: "dockerfile",
      status: "healthy",
      ports: [8080],
      domains: ["api.example.com"],
      publishToHost: false,
      autoRollbackEnabled: true,
      replicas: 2,
      limits: {
        cpuCores: 2,
        memoryMb: 1024,
        swapMb: 512,
      },
      maintenanceMode: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const adapted = adaptService(rawService)
    expect(adapted.id).toBe("srv-1")
    expect(adapted.status).toBe("running")
    expect(adapted.type).toBe("dockerfile")
    expect(adapted.portMappings[0]?.container).toBe(8080)
    expect(adapted.resourceSpecs?.cpuLimit).toBe(2)
    expect(adapted.resourceSpecs?.memoryLimitMb).toBe(1024)
    expect(adapted.domains?.[0]?.domain).toBe("api.example.com")
  })

  it("adapts ApiDeployment accurately", () => {
    const rawDeployment = {
      id: "dep-1",
      serviceId: "srv-1",
      commitHash: "a1b2c3d4",
      commitMessage: "feat: initial commit",
      branch: "main",
      author: "operator",
      status: "live",
      url: "https://example.com",
      steps: [
        {
          name: "Build",
          status: "success",
          durationMs: 4500,
        },
      ],
      durationMs: 8200,
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    const adapted = adaptDeployment(rawDeployment)
    expect(adapted.id).toBe("dep-1")
    expect(adapted.status).toBe("success")
    expect(adapted.commitHash).toBe("a1b2c3d4")
    expect(adapted.duration).toBe("8.2s")
    expect(adapted.steps?.length).toBe(1)
    expect(adapted.steps?.[0]?.status).toBe("success")
  })
})
