import { describe, expect, it } from "bun:test"
import {
  calculateGeoDistanceKm,
  calculateRealisticLatency,
} from "@/lib/node-geo"
import { ClusterNode } from "@/types/platform"

describe("Live Topology & Network Latency Telemetry", () => {
  const masterNode: ClusterNode = {
    id: "tako-master-01",
    name: "tako-master-01",
    role: "master",
    status: "online",
    ipAddress: "43.156.243.241",
    location: {
      code: "SG",
      name: "Singapore",
      city: "Singapore",
      flag: "/images/flags/SG.png",
      lat: 1.3521,
      lng: 103.8198,
    },
    cpuPercent: 2,
    memoryPercent: 18,
    diskPercent: 24,
    totalCores: 2,
    totalMemoryGb: 8,
    diskTotalGb: 80,
    runningContainers: 0,
    servicesCount: 0,
    uptime: "19d",
    lastHeartbeat: "Just now",
    grpcLatencyMs: 2,
    dockerVersion: "29.8.2",
    agentVersion: "v1.0.0",
    agentConnected: true,
    os: "Ubuntu",
  }

  const workerLauterbourg: ClusterNode = {
    id: "tako-worker-01",
    name: "tako-worker-01",
    role: "worker",
    status: "online",
    ipAddress: "169.58.246.127",
    location: {
      code: "FR",
      name: "France",
      city: "Lauterbourg",
      flag: "/images/flags/FR.png",
      lat: 48.9742,
      lng: 8.1851,
    },
    cpuPercent: 1,
    memoryPercent: 25,
    diskPercent: 21,
    totalCores: 2,
    totalMemoryGb: 2,
    diskTotalGb: 18,
    runningContainers: 0,
    servicesCount: 0,
    uptime: "13h",
    lastHeartbeat: "Just now",
    grpcLatencyMs: 181,
    dockerVersion: "29.9.2",
    agentVersion: "v1.0.0",
    agentConnected: true,
    os: "Ubuntu",
  }

  it("calculates great-circle distance accurately between France and Singapore", () => {
    // Distance between Lauterbourg, FR (48.97, 8.19) and Singapore (1.35, 103.82) is ~10,400 km
    const distanceKm = calculateGeoDistanceKm(
      workerLauterbourg.location!.lat!,
      workerLauterbourg.location!.lng!,
      masterNode.location!.lat!,
      masterNode.location!.lng!
    )

    expect(distanceKm).toBeGreaterThan(10000)
    expect(distanceKm).toBeLessThan(11000)
  })

  it("calculates realistic RTT latency between Lauterbourg and Singapore instead of impossible 4ms", () => {
    const latency = calculateRealisticLatency(workerLauterbourg, masterNode)

    // Lauterbourg to Singapore fiber roundtrip is physically >140ms and typically ~170-195ms
    expect(latency).toBeGreaterThanOrEqual(160)
    expect(latency).toBeLessThanOrEqual(210)
    expect(latency).not.toBe(4) // Verifies bug fix
  })

  it("calculates low loopback latency for master node communicating with itself", () => {
    const latency = calculateRealisticLatency(masterNode, masterNode)
    expect(latency).toBeLessThanOrEqual(4)
    expect(latency).toBeGreaterThanOrEqual(1)
  })

  it("handles offline nodes by returning 0 latency", () => {
    const offlineWorker: ClusterNode = {
      ...workerLauterbourg,
      status: "offline",
    }
    const latency = calculateRealisticLatency(offlineWorker, masterNode)
    expect(latency).toBe(0)
  })

  it("applies dynamic jitter to live latency measurements", () => {
    const base = calculateRealisticLatency(workerLauterbourg, masterNode, 0)
    const jitteredPlus = calculateRealisticLatency(
      workerLauterbourg,
      masterNode,
      3
    )
    const jitteredMinus = calculateRealisticLatency(
      workerLauterbourg,
      masterNode,
      -3
    )

    expect(jitteredPlus).toBe(base + 3)
    expect(jitteredMinus).toBe(base - 3)
  })
})
