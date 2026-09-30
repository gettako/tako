import type { Server, ServerDetail } from "../client"

export const mockServers: Server[] = [
  {
    id: "srv_local",
    name: "Primary Control Node (Local)",
    host: "127.0.0.1",
    status: "online",
    agent_version: "v1.0.0",
    agent_version_mismatch: false,
    cpu_percent: 18.4,
    ram_percent: 42.6,
    ram_total_bytes: 2147483648, // 2 GB
    ram_used_bytes: 915406848, // ~42.6%
    disk_percent: 54.1,
    active_services_count: 4,
    created_at: "2026-09-01T08:00:00Z",
    updated_at: "2026-09-29T02:40:00Z",
  },
  {
    id: "srv_worker_us",
    name: "Worker US-East (Virginia)",
    host: "198.51.100.22",
    status: "online",
    agent_version: "v0.9.4",
    agent_version_mismatch: true,
    cpu_percent: 46.2,
    ram_percent: 68.9,
    ram_total_bytes: 8589934592, // 8 GB
    ram_used_bytes: 5918386790, // ~68.9%
    disk_percent: 61.5,
    active_services_count: 3,
    created_at: "2026-09-05T10:15:00Z",
    updated_at: "2026-09-29T02:41:30Z",
  },
  {
    id: "srv_worker_eu",
    name: "Worker EU-Central (Frankfurt)",
    host: "203.0.113.85",
    status: "online",
    agent_version: "v1.0.0",
    agent_version_mismatch: false,
    cpu_percent: 8.7,
    ram_percent: 29.4,
    ram_total_bytes: 4294967296, // 4 GB
    ram_used_bytes: 1262718586, // ~29.4%
    disk_percent: 34.8,
    active_services_count: 1,
    created_at: "2026-09-12T14:30:00Z",
    updated_at: "2026-09-29T02:39:45Z",
  },
]

export const mockServerDetails: Record<string, ServerDetail> = {
  srv_local: {
    ...mockServers[0],
    docker_version: "26.1.4",
    os_info: "Ubuntu 24.04 LTS (x86_64)",
    uptime_seconds: 2419200,
    last_heartbeat_at: "2026-09-29T02:44:50Z",
    expected_agent_version: "v1.0.0",
    max_concurrent_builds: 2,
    services: [
      {
        id: "srv_web_prod",
        name: "acme-web",
        status: "running",
        internal_port: 3000,
      },
      {
        id: "srv_api_prod",
        name: "acme-api",
        status: "running",
        internal_port: 8080,
      },
      {
        id: "srv_blog",
        name: "personal-blog",
        status: "running",
        internal_port: 4321,
      },
      {
        id: "srv_docs",
        name: "internal-wiki",
        status: "stopped",
        internal_port: 3000,
      },
    ],
  },
  srv_worker_us: {
    ...mockServers[1],
    docker_version: "26.1.3",
    os_info: "Debian GNU/Linux 12 (bookworm)",
    uptime_seconds: 1814400,
    last_heartbeat_at: "2026-09-29T02:44:48Z",
    expected_agent_version: "v1.0.0",
    max_concurrent_builds: 4,
    services: [
      {
        id: "srv_storefront",
        name: "storefront-web",
        status: "building",
        internal_port: 3000,
      },
      {
        id: "srv_analytics",
        name: "analytics-collector",
        status: "unhealthy",
        internal_port: 9000,
      },
      {
        id: "srv_queue",
        name: "worker-queue",
        status: "running",
        internal_port: 5000,
      },
    ],
  },
  srv_worker_eu: {
    ...mockServers[2],
    docker_version: "26.1.4",
    os_info: "Ubuntu 22.04.4 LTS (aarch64)",
    uptime_seconds: 950400,
    last_heartbeat_at: "2026-09-29T02:44:52Z",
    expected_agent_version: "v1.0.0",
    max_concurrent_builds: 2,
    services: [
      {
        id: "srv_broken_app",
        name: "failing-service",
        status: "failed",
        internal_port: 8000,
      },
    ],
  },
}
