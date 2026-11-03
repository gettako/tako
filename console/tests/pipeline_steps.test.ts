import { describe, expect, it } from "bun:test"
import {
  generateLogsForDeployment,
  generateStepsForDeployment,
} from "@/lib/deployment-mock"
import type {
  DeploymentLogEntry,
  DeploymentRecord,
  ProjectService,
} from "@/types/platform"

describe("generateStepsForDeployment", () => {
  const dummyDeployment: DeploymentRecord = {
    id: "dep-123",
    serviceId: "srv-abc",
    status: "building",
    triggerBy: "user",
    commitHash: "a60ddda7",
    duration: "12s",
    startedAt: "10:00:00",
    message: "Initial commit",
  }

  it("dynamically advances running step based on incoming active logs", () => {
    // Scenario 1: Only Queued log received
    const logs1: DeploymentLogEntry[] = [
      {
        id: "l1",
        timestamp: "10:00:01",
        level: "info",
        step: "Queued",
        message: "Deployment dep-123 initialized",
      },
    ]
    const steps1 = generateStepsForDeployment(dummyDeployment, true, "node-1", logs1)
    expect(steps1[0].name).toBe("Queued")
    expect(steps1[0].status).toBe("running")
    expect(steps1[1].name).toBe("Clone")
    expect(steps1[1].status).toBe("pending")

    // Scenario 2: Build is running
    const logs2: DeploymentLogEntry[] = [
      ...logs1,
      {
        id: "l2",
        timestamp: "10:00:02",
        level: "info",
        step: "Clone",
        message: "Cloned successfully",
      },
      {
        id: "l3",
        timestamp: "10:00:03",
        level: "info",
        step: "Build",
        message: "Building Dockerfile...",
      },
    ]
    const steps2 = generateStepsForDeployment(dummyDeployment, true, "node-1", logs2)
    expect(steps2[0].status).toBe("success") // Queued done
    expect(steps2[1].status).toBe("success") // Clone done
    expect(steps2[2].name).toBe("Build")
    expect(steps2[2].status).toBe("running") // Build running
    expect(steps2[3].name).toBe("Push/Load image")
    expect(steps2[3].status).toBe("pending") // Next step pending

    // Scenario 3: Deploy is running
    const logs3: DeploymentLogEntry[] = [
      ...logs2,
      {
        id: "l4",
        timestamp: "10:00:04",
        level: "info",
        step: "Push/Load image",
        message: "Image ready for deployment",
      },
      {
        id: "l5",
        timestamp: "10:00:05",
        level: "info",
        step: "Deploy",
        message: "Prepared Traefik routing rules",
      },
    ]
    const steps3 = generateStepsForDeployment(dummyDeployment, true, "node-1", logs3)
    expect(steps3[2].status).toBe("success") // Build completed
    expect(steps3[3].status).toBe("success") // Push/Load completed
    expect(steps3[4].name).toBe("Deploy")
    expect(steps3[4].status).toBe("running") // Deploy running
    expect(steps3[5].name).toBe("Health check")
    expect(steps3[5].status).toBe("pending")

    // Scenario 4: Live reached
    const logs4: DeploymentLogEntry[] = [
      ...logs3,
      {
        id: "l6",
        timestamp: "10:00:06",
        level: "info",
        step: "Health check",
        message: "Health check passed",
      },
      {
        id: "l7",
        timestamp: "10:00:07",
        level: "info",
        step: "Live",
        message: "Service is live!",
      },
    ]
    const steps4 = generateStepsForDeployment(dummyDeployment, false, "node-1", logs4)
    expect(steps4.every((s) => s.status === "success")).toBe(true)
  })

  it("marks failure and skips subsequent steps when error occurs", () => {
    const errorLogs: DeploymentLogEntry[] = [
      {
        id: "l1",
        timestamp: "10:00:01",
        level: "info",
        step: "Queued",
        message: "Initialized",
      },
      {
        id: "l2",
        timestamp: "10:00:02",
        level: "error",
        step: "Build",
        message: "Compilation error: syntax error",
      },
    ]
    const steps = generateStepsForDeployment(dummyDeployment, false, "node-1", errorLogs)
    expect(steps[0].status).toBe("success")
    expect(steps[2].name).toBe("Build")
    expect(steps[2].status).toBe("failed")
    expect(steps[3].status).toBe("skipped")
    expect(steps[4].status).toBe("skipped")
    expect(steps[5].status).toBe("skipped")
    expect(steps[6].status).toBe("skipped")
  })
})

describe("generateLogsForDeployment", () => {
  const dummyService = {
    id: "srv-1",
    name: "Web Service",
    slug: "web-service",
    targetNodeId: "node-master",
    status: "running",
    deploymentHistory: [],
    lastDeployment: {
      id: "dep-1",
      commitHash: "a60ddda7",
      status: "success",
      duration: "10s",
      startedAt: "10:00:00",
      triggerBy: "user",
      serviceId: "srv-1",
      message: "Ready",
    },
  } as unknown as ProjectService

  it("parses raw historical logs into clean structured entries", () => {
    const depWithRaw: DeploymentRecord = {
      ...dummyService.lastDeployment,
      rawLogs: `[02:23:53] [Build] Successfully tagged tako/tako-edge-proxy:a60ddda7
[02:23:54] [Push/Load image] Image ready for deployment
[02:23:55] [Deploy] Container started successfully
[02:23:56] [Health check] Health check passed: container is stable
[02:23:57] [Live] Service is live and ready!`,
    }

    const logs = generateLogsForDeployment(depWithRaw, dummyService, [], false)
    expect(logs.length).toBe(5)
    expect(logs[0].step).toBe("Build")
    expect(logs[0].timestamp).toBe("02:23:53")
    expect(logs[0].message).toBe("Successfully tagged tako/tako-edge-proxy:a60ddda7")

    expect(logs[2].step).toBe("Deploy")
    expect(logs[2].timestamp).toBe("02:23:55")
    expect(logs[2].message).toBe("Container started successfully")

    expect(logs[3].step).toBe("Health check")
    expect(logs[3].timestamp).toBe("02:23:56")
  })
})
