import { describe, expect, it } from "bun:test"
import {
  adaptDeployment,
  adaptNode,
  adaptProject,
  adaptService,
  formatCommitHash,
  formatDuration,
  formatNodeLocation,
  formatRelativeTime,
} from "@/lib/adapters"
import type { ApiNode, ApiProject, ApiService } from "@/lib/api"

describe("Format Utilities", () => {
  it("formats relative time correctly", () => {
    expect(formatRelativeTime(null)).toBe("Never")
    expect(formatRelativeTime("invalid-date")).toBe("Unknown")
    const now = new Date().toISOString()
    expect(formatRelativeTime(now)).toBe("Just now")
  })

  it("formats durations accurately", () => {
    expect(formatDuration(undefined)).toBe("-")
    expect(formatDuration(0)).toBe("-")
    expect(formatDuration(450)).toBe("450ms")
    expect(formatDuration(12500)).toBe("12.5s")
    expect(formatDuration(95000)).toBe("1m 35s")
  })

  it("formats commit hashes correctly to 7 characters", () => {
    expect(formatCommitHash(null)).toBe("untracked")
    expect(formatCommitHash("")).toBe("untracked")
    expect(formatCommitHash("abc")).toBe("abc")
    expect(formatCommitHash("864369991ebb0ce00cff990fcd80417e216282b6")).toBe(
      "8643699"
    )
    expect(
      formatCommitHash("864369991ebb0ce00cff990fcd80417e216282b6", 10)
    ).toBe("864369991e")
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
    expect(adapted.agentVersion).toBe("v1.0.0")
    expect(adapted.cpuPercent).toBe(24.5)
    expect(adapted.memoryPercent).toBe(50) // 8192 / 16384 * 100
    expect(adapted.diskPercent).toBe(25) // 125 / 500 * 100
    expect(adapted.totalMemoryGb).toBe(16)

    const customVersionAdapted = adaptNode({
      ...rawNode,
      agentVersion: "v1.2.3",
    })
    expect(customVersionAdapted.agentVersion).toBe("v1.2.3")

    const masterNodeAdapted = adaptNode({ ...rawNode, role: "master" })
    expect(masterNodeAdapted.role).toBe("master")

    const workerNodeAdapted = adaptNode({ ...rawNode, role: "worker" })
    expect(workerNodeAdapted.role).toBe("worker")
  })

  it("formats node location accurately with city deduplication and country tooltip", () => {
    // Redundant city and country e.g. Singapore, Singapore -> display "Singapore", country "Singapore"
    const sgDedupe = formatNodeLocation({ name: "Singapore, Singapore" })
    expect(sgDedupe.display).toBe("Singapore")
    expect(sgDedupe.country).toBe("Singapore")

    const sgCityCountry = formatNodeLocation({
      city: "Singapore",
      country: "Singapore",
    })
    expect(sgCityCountry.display).toBe("Singapore")
    expect(sgCityCountry.country).toBe("Singapore")

    // Distinct city and country e.g. Lauterbourg, France -> display "Lauterbourg", country "France"
    const frSeparate = formatNodeLocation({ name: "Lauterbourg, France" })
    expect(frSeparate.display).toBe("Lauterbourg")
    expect(frSeparate.country).toBe("France")

    const frCityCountry = formatNodeLocation({
      city: "Lauterbourg",
      country: "France",
    })
    expect(frCityCountry.display).toBe("Lauterbourg")
    expect(frCityCountry.country).toBe("France")

    // Fallbacks
    expect(formatNodeLocation(undefined).display).toBe("Edge Host")
    expect(formatNodeLocation({ name: "Local Network" }).country).toBe("Local Network")
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

  it("adapts raw database deployment with snake_case and JSON string steps", () => {
    const dbDeployment = {
      id: "dep-2",
      service_id: "srv-1",
      commit_hash: "fedcba98",
      commit_message: "chore: rebuild service",
      branch: "main",
      author: "system",
      status: "live",
      url: "https://preview.example.com",
      steps: JSON.stringify([
        {
          name: "Queued",
          status: "success",
          duration_ms: 300,
        },
        {
          name: "Deploy",
          status: "success",
          duration_ms: 1200,
        },
      ]),
      duration_ms: 1500,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }

    const adapted = adaptDeployment(dbDeployment as any)
    expect(adapted.id).toBe("dep-2")
    expect(adapted.serviceId).toBe("srv-1")
    expect(adapted.status).toBe("success")
    expect(adapted.commitHash).toBe("fedcba98")
    expect(adapted.message).toBe("chore: rebuild service")
    expect(adapted.duration).toBe("1.5s")
    expect(adapted.steps?.length).toBe(2)
    expect(adapted.steps?.[0]?.name).toBe("Queued")
    expect(adapted.steps?.[1]?.name).toBe("Deploy")
  })

  it("handles environment variables editor parsing and formatting", () => {
    const rawEnvText = `
# Server Configuration
PORT=8080
NODE_ENV="production"
DATABASE_URL='postgres://user:pass@localhost:5432/db'
EMPTY_VAL=
# Comment line
CUSTOM_FLAG=true
`
    const parsed = rawEnvText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const eq = l.indexOf("=")
        if (eq === -1) return { key: l, value: "" }
        let val = l.slice(eq + 1).trim()
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1)
        }
        return { key: l.slice(0, eq).trim(), value: val }
      })
      .filter((i) => i.key.length > 0)

    expect(parsed.length).toBe(5)
    expect(parsed[0]).toEqual({ key: "PORT", value: "8080" })
    expect(parsed[1]).toEqual({ key: "NODE_ENV", value: "production" })
    expect(parsed[2]).toEqual({
      key: "DATABASE_URL",
      value: "postgres://user:pass@localhost:5432/db",
    })
    expect(parsed[3]).toEqual({ key: "EMPTY_VAL", value: "" })
    expect(parsed[4]).toEqual({ key: "CUSTOM_FLAG", value: "true" })

    // Formatting back to .env
    const formatted = parsed.map((e) => `${e.key}=${e.value}`).join("\n")
    expect(formatted).toContain("PORT=8080")
    expect(formatted).toContain("CUSTOM_FLAG=true")
  })
})
