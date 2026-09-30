import type { BuildLogStreamEvent, ContainerLogEvent } from "../client"

export const mockBuildLogs: BuildLogStreamEvent[] = [
  {
    event: "build_step",
    step: "1/6",
    title: "FROM node:20-alpine AS base",
    status: "running",
    duration_seconds: null,
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "Pulling from library/node:20-alpine",
    timestamp: "2026-09-28T17:58:01.000Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "Digest: sha256:d8b2d18290fbbd279cf431ad3499b247f12e8b23f8516087",
    timestamp: "2026-09-28T17:58:02.100Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "Status: Image is up to date for node:20-alpine",
    timestamp: "2026-09-28T17:58:03.000Z",
  },
  {
    event: "build_step",
    step: "1/6",
    title: "FROM node:20-alpine AS base",
    status: "success",
    duration_seconds: 3,
  },

  {
    event: "build_step",
    step: "2/6",
    title: "WORKDIR /app && apk add --no-cache libc6-compat",
    status: "running",
    duration_seconds: null,
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "fetch https://dl-cdn.alpinelinux.org/alpine/v3.20/main/x86_64/APKINDEX.tar.gz",
    timestamp: "2026-09-28T17:58:04.100Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "fetch https://dl-cdn.alpinelinux.org/alpine/v3.20/community/x86_64/APKINDEX.tar.gz",
    timestamp: "2026-09-28T17:58:04.800Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "(1/1) Installing libc6-compat (1.2.5-r0)",
    timestamp: "2026-09-28T17:58:05.500Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "OK: 11 MiB in 18 packages",
    timestamp: "2026-09-28T17:58:06.000Z",
  },
  {
    event: "build_step",
    step: "2/6",
    title: "WORKDIR /app && apk add --no-cache libc6-compat",
    status: "success",
    duration_seconds: 3,
  },

  {
    event: "build_step",
    step: "3/6",
    title: "COPY package.json bun.lock ./",
    status: "running",
    duration_seconds: null,
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "Transferring context: 48.2 kB",
    timestamp: "2026-09-28T17:58:07.100Z",
  },
  {
    event: "build_step",
    step: "3/6",
    title: "COPY package.json bun.lock ./",
    status: "success",
    duration_seconds: 1,
  },

  {
    event: "build_step",
    step: "4/6",
    title: "RUN bun install --frozen-lockfile",
    status: "running",
    duration_seconds: null,
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "bun install v1.4.2 (50a8a8387)",
    timestamp: "2026-09-28T17:58:08.000Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "  Resolving dependencies...",
    timestamp: "2026-09-28T17:58:09.200Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "  Downloaded react (19.2.8)",
    timestamp: "2026-09-28T17:58:10.500Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "  Downloaded react-dom (19.2.8)",
    timestamp: "2026-09-28T17:58:11.100Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "  Downloaded next (16.3.4)",
    timestamp: "2026-09-28T17:58:12.400Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "  Downloaded @base-ui/react (1.8.0)",
    timestamp: "2026-09-28T17:58:13.000Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "  Downloaded tailwindcss (4.1.2)",
    timestamp: "2026-09-28T17:58:14.000Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "  Saved lockfile: 45 packages installed [6.82s]",
    timestamp: "2026-09-28T17:58:15.000Z",
  },
  {
    event: "build_step",
    step: "4/6",
    title: "RUN bun install --frozen-lockfile",
    status: "success",
    duration_seconds: 7,
  },

  {
    event: "build_step",
    step: "5/6",
    title: "COPY . . && RUN bun run build",
    status: "running",
    duration_seconds: null,
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "Next.js 16.3.4 (App Router) build starting...",
    timestamp: "2026-09-28T17:58:16.000Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "✓ Compiled successfully in 12.4s",
    timestamp: "2026-09-28T17:58:28.400Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "✓ Linting and checking validity of types",
    timestamp: "2026-09-28T17:58:32.000Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "✓ Collecting page data",
    timestamp: "2026-09-28T17:58:34.100Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "✓ Generating static pages (12/12)",
    timestamp: "2026-09-28T17:58:36.500Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "Route (app)                              Size     First Load JS",
    timestamp: "2026-09-28T17:58:37.000Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "┌ ○ /                                    5.4 kB         98.2 kB",
    timestamp: "2026-09-28T17:58:37.100Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "├ ○ /_not-found                          1.1 kB         93.9 kB",
    timestamp: "2026-09-28T17:58:37.200Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "├ λ /api/health                          0 B                  0 B",
    timestamp: "2026-09-28T17:58:37.300Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "└ λ /dashboard                           8.2 kB         101.0 kB",
    timestamp: "2026-09-28T17:58:37.400Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "+ First Load JS shared by all            92.8 kB",
    timestamp: "2026-09-28T17:58:37.500Z",
  },
  {
    event: "build_step",
    step: "5/6",
    title: "COPY . . && RUN bun run build",
    status: "success",
    duration_seconds: 22,
  },

  {
    event: "build_step",
    step: "6/6",
    title: 'EXPOSE 3000 && CMD ["bun", "run", "start"]',
    status: "running",
    duration_seconds: null,
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "Tagging image: tako-app-srv_web_prod:dep_001",
    timestamp: "2026-09-28T17:58:38.000Z",
  },
  {
    event: "build_log",
    stream: "stdout",
    line: "Build completed successfully in 38s",
    timestamp: "2026-09-28T17:58:39.000Z",
  },
  {
    event: "build_step",
    step: "6/6",
    title: 'EXPOSE 3000 && CMD ["bun", "run", "start"]',
    status: "success",
    duration_seconds: 2,
  },

  {
    event: "build_complete",
    status: "success",
    image_tag: "tako-app-srv_web_prod:dep_001",
    duration_seconds: 38,
    error: null,
  },
]

export const mockContainerLogs: ContainerLogEvent[] = Array.from({
  length: 320,
}).map((_, idx) => {
  const second = String(idx % 60).padStart(2, "0")
  const minute = String(Math.floor((idx / 60) % 60)).padStart(2, "0")
  const time = `2026-09-29T02:${minute}:${second}.100Z`

  const logTypes = [
    {
      stream: "stdout" as const,
      line: `[HTTP] GET /api/services 200 in 1.4ms - 198.51.100.1 - Node worker #1`,
    },
    {
      stream: "stdout" as const,
      line: `[HTTP] GET /dashboard/projects/prj_acme 200 in 3.8ms - User usr_admin`,
    },
    {
      stream: "stdout" as const,
      line: `[METRICS] Active connections: 42, HeapUsed: 68.4 MB, RSS: 142.1 MB`,
    },
    {
      stream: "stdout" as const,
      line: `[HEALTH] HTTP GET /healthz 200 OK (latency: 0.8ms)`,
    },
    {
      stream: "stderr" as const,
      line: `[WARN] Slow upstream DNS lookup for registry.hub.docker.com (took 140ms)`,
    },
    {
      stream: "stdout" as const,
      line: `[QUEUE] Processed deployment job payload for dep_001 (status: success)`,
    },
    {
      stream: "stdout" as const,
      line: `[HTTP] POST /api/auth/me 200 in 2.1ms - session validated via cookie`,
    },
    {
      stream: "stderr" as const,
      line: `[NOTICE] Client disconnected from SSE /api/services/srv_web_prod/logs/runtime`,
    },
  ]

  const selected = logTypes[idx % logTypes.length]
  return {
    container_id: "c7a8b9f01234",
    stream: selected.stream,
    line: `[${time}] ${selected.line} (req_id=${idx + 1000})`,
    timestamp: time,
  }
})
