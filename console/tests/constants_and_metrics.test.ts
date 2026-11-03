import { describe, expect, it } from "bun:test"
import {
  API_BASE,
  CUSTOM_EVENTS,
  DEFAULT_PORTS,
  STORAGE_KEYS,
  type ApiService,
} from "@/lib/api"
import { adaptService } from "@/lib/adapters"
import {
  CHART_PADDING,
  CHART_WIDTH,
  buildChartArea,
  buildChartLine,
  buildSmoothChartArea,
  buildSmoothChartLine,
  getChartCoordinates,
} from "@/lib/chart"
import {
  DEPLOYMENT_STATUS,
  DEPLOYMENT_STEP_STATUS,
  NODE_ROLE,
  NODE_STATUS,
  PROJECT_ENVIRONMENT,
  SERVICE_STATUS,
  SERVICE_TYPE,
  USER_ROLE,
  type ClusterNode,
} from "@/types/platform"

describe("API Client & Domain Constants Specification", () => {
  it("defines standard platform ports", () => {
    expect(DEFAULT_PORTS.HTTP).toBe(8080)
    expect(DEFAULT_PORTS.GRPC).toBe(50051)
    expect(DEFAULT_PORTS.CONSOLE).toBe(3000)
    expect(DEFAULT_PORTS.TRAEFIK_WEB).toBe(80)
    expect(DEFAULT_PORTS.TRAEFIK_WEBSECURE).toBe(443)
    expect(DEFAULT_PORTS.SMTP).toBe(587)
  })

  it("defines persistent storage keys, events, and API base", () => {
    expect(API_BASE).toBe("/api/v1")
    expect(STORAGE_KEYS.AUTH_TOKEN).toBe("tako_token")
    expect(STORAGE_KEYS.NODES_VIEW_MODE).toBe("tako_view_mode_nodes")
    expect(STORAGE_KEYS.PROJECTS_VIEW_MODE).toBe("tako_view_mode_projects")
    expect(STORAGE_KEYS.SERVICES_VIEW_MODE).toBe("tako_view_mode_services")
    expect(CUSTOM_EVENTS.UNAUTHORIZED).toBe("tako:unauthorized")
  })

  it("defines central platform domain enums / constants", () => {
    expect(NODE_STATUS.ONLINE).toBe("online")
    expect(NODE_STATUS.DEGRADED).toBe("degraded")
    expect(NODE_STATUS.OFFLINE).toBe("offline")

    expect(NODE_ROLE.MASTER).toBe("master")
    expect(NODE_ROLE.WORKER).toBe("worker")

    expect(SERVICE_STATUS.RUNNING).toBe("running")
    expect(SERVICE_STATUS.DEPLOYING).toBe("deploying")
    expect(SERVICE_STATUS.STOPPED).toBe("stopped")
    expect(SERVICE_STATUS.FAILED).toBe("failed")

    expect(SERVICE_TYPE.DOCKERFILE).toBe("dockerfile")
    expect(SERVICE_TYPE.COMPOSE).toBe("docker-compose")

    expect(PROJECT_ENVIRONMENT.PRODUCTION).toBe("production")
    expect(PROJECT_ENVIRONMENT.STAGING).toBe("staging")
    expect(PROJECT_ENVIRONMENT.PREVIEW).toBe("preview")

    expect(DEPLOYMENT_STATUS.SUCCESS).toBe("success")
    expect(DEPLOYMENT_STATUS.FAILED).toBe("failed")
    expect(DEPLOYMENT_STATUS.BUILDING).toBe("building")
    expect(DEPLOYMENT_STATUS.ROLLED_BACK).toBe("rolled_back")
    expect(DEPLOYMENT_STATUS.PENDING).toBe("pending")

    expect(DEPLOYMENT_STEP_STATUS.PENDING).toBe("pending")
    expect(DEPLOYMENT_STEP_STATUS.RUNNING).toBe("running")
    expect(DEPLOYMENT_STEP_STATUS.SUCCESS).toBe("success")
    expect(DEPLOYMENT_STEP_STATUS.FAILED).toBe("failed")
    expect(DEPLOYMENT_STEP_STATUS.SKIPPED).toBe("skipped")

    expect(USER_ROLE.OWNER).toBe("owner")
    expect(USER_ROLE.ADMIN).toBe("admin")
    expect(USER_ROLE.MEMBER).toBe("member")
  })
})

describe("Cluster Stats & Telemetry Calculations", () => {
  const sampleNodes: ClusterNode[] = [
    {
      id: "node-1",
      name: "Edge Alpha",
      role: "master",
      status: "online",
      ipAddress: "192.168.1.10",
      location: { code: "SG", name: "Singapore", flag: "/flags/sg.svg" },
      grpcLatencyMs: 4,
      dockerVersion: "26.1",
      os: "linux",
      agentConnected: true,
      cpuPercent: 30,
      memoryPercent: 50,
      diskPercent: 40,
      totalCores: 8,
      totalMemoryGb: 16,
      diskTotalGb: 100,
      runningContainers: 3,
      servicesCount: 3,
      uptime: "10d",
      lastHeartbeat: "Just now",
    },
    {
      id: "node-2",
      name: "Edge Beta",
      role: "worker",
      status: "online",
      ipAddress: "192.168.1.11",
      location: { code: "US", name: "United States", flag: "/flags/us.svg" },
      grpcLatencyMs: 12,
      dockerVersion: "26.1",
      os: "linux",
      agentConnected: true,
      cpuPercent: 70,
      memoryPercent: 60,
      diskPercent: 50,
      totalCores: 4,
      totalMemoryGb: 8,
      diskTotalGb: 100,
      runningContainers: 2,
      servicesCount: 2,
      uptime: "5d",
      lastHeartbeat: "Just now",
    },
    {
      id: "node-3",
      name: "Edge Offline",
      role: "worker",
      status: "offline",
      ipAddress: "192.168.1.12",
      location: { code: "DE", name: "Germany", flag: "/flags/de.svg" },
      grpcLatencyMs: 0,
      dockerVersion: "26.1",
      os: "linux",
      agentConnected: false,
      cpuPercent: 0,
      memoryPercent: 0,
      diskPercent: 0,
      totalCores: 8,
      totalMemoryGb: 16,
      diskTotalGb: 100,
      runningContainers: 0,
      servicesCount: 0,
      uptime: "0s",
      lastHeartbeat: "1d ago",
    },
  ]

  it("calculates average CPU, RAM, and gRPC latency only from online nodes", () => {
    const onlineNodes = sampleNodes.filter((n) => n.status === "online")
    expect(onlineNodes.length).toBe(2)

    // CPU average: (30 + 70) / 2 = 50%
    const avgCpu = Math.round(
      onlineNodes.reduce((acc, n) => acc + n.cpuPercent, 0) / onlineNodes.length
    )
    expect(avgCpu).toBe(50)

    // Memory average: (50 + 60) / 2 = 55%
    const avgMem = Math.round(
      onlineNodes.reduce((acc, n) => acc + n.memoryPercent, 0) /
        onlineNodes.length
    )
    expect(avgMem).toBe(55)

    // Average latency: (4 + 12) / 2 = 8ms
    const avgLatency = Math.round(
      onlineNodes.reduce((acc, n) => acc + n.grpcLatencyMs, 0) /
        onlineNodes.length
    )
    expect(avgLatency).toBe(8)
  })

  it("preserves precise decimal MB for network throughput in adaptService", () => {
    const mockApiService: ApiService = {
      id: "srv-metrics-prec",
      projectId: "prj-1",
      nodeId: "node-1",
      name: "Precise Service",
      slug: "prec-srv",
      type: "dockerfile",
      status: "running",
      ports: [8080],
      domains: [],
      publishToHost: false,
      autoRollbackEnabled: false,
      replicas: 1,
      limits: { cpuCores: 1, memoryMb: 512, swapMb: 0 },
      usage: {
        cpuPercent: 25.4,
        memoryUsedMb: 256,
        memoryLimitMb: 512,
        networkRxKbps: 350.5, // 350.5 / 1024 = ~0.34 MB
        networkTxKbps: 800.2, // 800.2 / 1024 = ~0.78 MB
      },
      maintenanceMode: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const adapted = adaptService(mockApiService)
    expect(adapted.metrics.cpuPercent).toBe(25.4)
    expect(adapted.metrics.memoryMb).toBe(256)
    expect(adapted.metrics.networkRxMb).toBe(0.34)
    expect(adapted.metrics.networkTxMb).toBe(0.78)
  })
})

describe("Telemetry & Responsive Chart Geometry", () => {
  it("defaults to standard CHART_WIDTH when width is omitted", () => {
    const values = [0, 50, 100]
    const coords = getChartCoordinates(values, 0, 100)
    expect(coords.length).toBe(3)
    expect(coords[0].x).toBe(CHART_PADDING.left)
    expect(coords[2].x).toBe(CHART_WIDTH - CHART_PADDING.right)
  })

  it("scales coordinates to full custom width dynamically", () => {
    const values = [10, 50, 90]
    const customWidth = 1200
    const coords = getChartCoordinates(values, 0, 100, customWidth)

    expect(coords.length).toBe(3)
    expect(coords[0].x).toBe(CHART_PADDING.left)
    expect(coords[2].x).toBe(customWidth - CHART_PADDING.right)

    const line = buildChartLine(coords, customWidth)
    expect(line).toContain(`M ${CHART_PADDING.left}`)
    expect(line).toContain(`L ${customWidth - CHART_PADDING.right}`)

    const area = buildChartArea(coords, customWidth)
    expect(area).toContain(`L ${customWidth - CHART_PADDING.right}`)
  })

  it("generates smooth cubic bezier curves without sharp jagged corners", () => {
    const values = [10, 80, 20, 90, 40]
    const coords = getChartCoordinates(values, 0, 100)

    const smoothLine = buildSmoothChartLine(coords)
    expect(smoothLine.startsWith("M ")).toBe(true)
    // Smooth line uses cubic Bezier 'C' commands rather than linear 'L'
    expect(smoothLine).toContain(" C ")
    expect(smoothLine).not.toContain(" L ")

    const smoothArea = buildSmoothChartArea(coords)
    expect(smoothArea).toContain(" C ")
    expect(smoothArea.endsWith(" Z")).toBe(true)

    // Verify buildChartLine with smooth=true delegates to smooth curves
    const delegatedLine = buildChartLine(coords, CHART_WIDTH, true)
    expect(delegatedLine).toBe(smoothLine)
  })
})
