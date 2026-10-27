import type {
  DeploymentLogEntry,
  DeploymentPipelineStep,
  DeploymentRecord,
  DeploymentStepName,
  ProjectService,
} from "@/types/platform"

export const STEP_KEYWORDS: Record<DeploymentStepName, string[]> = {
  Queued: ["dispatch", "grpc", "queued", "request"],
  Clone: ["clone", "archive", "workspace", "stream"],
  Build: ["build", "docker", "buildkit", "engine", "layer", "compile"],
  "Push/Load image": ["push", "image", "load", "registry"],
  Deploy: ["deploy", "container", "instantiation", "lifecycle", "spawn"],
  "Health check": ["health", "probe", "tcp", "http", "checkz"],
  Live: ["live", "ready", "routing", "ingress", "cutover", "telemetry"],
}

export function generateStepsForDeployment(
  dep: DeploymentRecord,
  isCurrentlyDeploying: boolean,
  targetNodeId: string
): DeploymentPipelineStep[] {
  if (dep.steps && dep.steps.length === 7) {
    return dep.steps
  }

  // Undeployed / pending service (saved but not yet deployed)
  if (!isCurrentlyDeploying && (!dep.id || dep.status === "pending")) {
    return [
      {
        name: "Queued",
        status: "pending",
        duration: "-",
        description: "Awaiting deployment trigger",
      },
      {
        name: "Clone",
        status: "pending",
        duration: "-",
        description: "Git repository source sync",
      },
      {
        name: "Build",
        status: "pending",
        duration: "-",
        description: "Container image compilation",
      },
      {
        name: "Push/Load image",
        status: "pending",
        duration: "-",
        description: "Registry or engine layer caching",
      },
      {
        name: "Deploy",
        status: "pending",
        duration: "-",
        description: "Container instantiation on node " + targetNodeId,
      },
      {
        name: "Health check",
        status: "pending",
        duration: "-",
        description: "Zero-downtime health probe",
      },
      {
        name: "Live",
        status: "pending",
        duration: "-",
        description: "Proxy cutover and telemetry active",
      },
    ]
  }

  // Active live deploying
  if (isCurrentlyDeploying) {
    return [
      {
        name: "Queued",
        status: "success",
        duration: "0.4s",
        startedAt: "10:14:02.100",
        description: "Dispatched to worker agent queue",
      },
      {
        name: "Clone",
        status: "success",
        duration: "1.1s",
        startedAt: "10:14:02.500",
        description: "Cloned git commit reference",
      },
      {
        name: "Build",
        status: "running",
        duration: "in progress...",
        startedAt: "10:14:03.600",
        description: "Docker BuildKit image compilation",
      },
      {
        name: "Push/Load image",
        status: "pending",
        duration: "pending",
        description: "Pushing to registry / local engine",
      },
      {
        name: "Deploy",
        status: "pending",
        duration: "pending",
        description: "Container instantiation on node " + targetNodeId,
      },
      {
        name: "Health check",
        status: "pending",
        duration: "pending",
        description: "Zero-downtime TCP/HTTP probe",
      },
      {
        name: "Live",
        status: "pending",
        duration: "pending",
        description: "Proxy cutover and telemetry active",
      },
    ]
  }

  // Failed build
  if (dep.status === "failed") {
    return [
      {
        name: "Queued",
        status: "success",
        duration: "0.4s",
        startedAt: "10:14:02.100",
        description: "Dispatched via gRPC stream",
      },
      {
        name: "Clone",
        status: "success",
        duration: "0.8s",
        startedAt: "10:14:02.500",
        description: "Fetched source tree and cache layers",
      },
      {
        name: "Build",
        status: "failed",
        duration: dep.duration || "1.4s",
        startedAt: "10:14:03.300",
        description: "BuildKit syntax error (exited with status 1)",
      },
      {
        name: "Push/Load image",
        status: "skipped",
        duration: "skipped",
        description: "Skipped due to upstream build failure",
      },
      {
        name: "Deploy",
        status: "skipped",
        duration: "skipped",
        description: "Skipped due to upstream build failure",
      },
      {
        name: "Health check",
        status: "skipped",
        duration: "skipped",
        description: "Skipped due to upstream build failure",
      },
      {
        name: "Live",
        status: "skipped",
        duration: "skipped",
        description: "Prior version preserved in production",
      },
    ]
  }

  // Succeeded or rolled back deployment
  const parsedDur = parseInt(dep.duration) || 38
  const buildSec = Math.max(10, parsedDur - 9) + "s"

  return [
    {
      name: "Queued",
      status: "success",
      duration: "0.4s",
      startedAt: "10:14:02.100",
      description: "Dispatched via mTLS gRPC",
    },
    {
      name: "Clone",
      status: "success",
      duration: "0.9s",
      startedAt: "10:14:02.500",
      description: "Validated git commit & cache tree",
    },
    {
      name: "Build",
      status: "success",
      duration: buildSec,
      startedAt: "10:14:03.400",
      description: "BuildKit compiled image artifact",
    },
    {
      name: "Push/Load image",
      status: "success",
      duration: "2.8s",
      startedAt: "10:14:26.300",
      description: "Image loaded into container engine",
    },
    {
      name: "Deploy",
      status: "success",
      duration: "2.1s",
      startedAt: "10:14:29.100",
      description: "Spawned container on " + targetNodeId,
    },
    {
      name: "Health check",
      status: "success",
      duration: "1.2s",
      startedAt: "10:14:31.200",
      description: "HTTP /healthz probe passed 200 OK",
    },
    {
      name: "Live",
      status: "success",
      duration: "0.3s",
      startedAt: "10:14:32.400",
      description: "Zero-downtime ingress cutover confirmed",
    },
  ]
}

export function generateLogsForDeployment(
  dep: DeploymentRecord,
  service: ProjectService,
  activeLogs: DeploymentLogEntry[],
  isCurrentlyDeploying: boolean
): DeploymentLogEntry[] {
  if (isCurrentlyDeploying) {
    return activeLogs
  }

  // Undeployed / pending service (saved but not yet deployed)
  if (!dep.id || dep.status === "pending") {
    return [
      {
        id: "log-initial-pending",
        timestamp: "00:00:00.000",
        level: "info",
        step: "Queued",
        message:
          "Service configuration saved. No build executed yet. Click Deploy to trigger build and deployment.",
      },
    ]
  }

  if (dep.status === "failed") {
    return [
      {
        id: `${dep.id}-1`,
        timestamp: "10:14:02.102",
        level: "info",
        step: "gRPC Handshake",
        message: `Connected to tako-agent on ${service.targetNodeId} via mTLS`,
      },
      {
        id: `${dep.id}-2`,
        timestamp: "10:14:02.340",
        level: "info",
        step: "Dispatch BuildContext",
        message: "Master streamed compressed tar archive to remote agent",
      },
      {
        id: `${dep.id}-3`,
        timestamp: "10:14:03.110",
        level: "info",
        step: "Docker Engine",
        message: "Agent invokes BuildKit API: [1/4] FROM golang:1.23-alpine",
      },
      {
        id: `${dep.id}-err1`,
        timestamp: "10:14:04.520",
        level: "error",
        step: "Docker Engine",
        message:
          "BuildKit compilation error: /workspace/main.go:42: syntax error: unexpected semicolon, expecting comma or }",
      },
      {
        id: `${dep.id}-err2`,
        timestamp: "10:14:04.525",
        level: "error",
        step: "Docker Engine",
        message: "Process exited with status 1. Build aborted.",
      },
    ]
  }

  return [
    {
      id: `${dep.id}-1`,
      timestamp: "10:14:02.102",
      level: "info",
      step: "gRPC Handshake",
      message: `Connected to tako-agent on ${service.targetNodeId} via mTLS`,
    },
    {
      id: `${dep.id}-2`,
      timestamp: "10:14:02.340",
      level: "info",
      step: "Dispatch BuildContext",
      message: "Master streamed 1.42 MB compressed tar archive to remote agent",
    },
    {
      id: `${dep.id}-3`,
      timestamp: "10:14:03.110",
      level: "info",
      step: "Docker Engine",
      message: `Agent invokes BuildKit API for commit ${dep.commitHash}`,
    },
    {
      id: `${dep.id}-4`,
      timestamp: "10:14:08.450",
      level: "info",
      step: "Docker Engine",
      message: "Cached layer sha256:7b91e... Verified integrity",
    },
    {
      id: `${dep.id}-5`,
      timestamp: "10:14:14.920",
      level: "info",
      step: "Docker Engine",
      message:
        "[3/5] RUN CGO_ENABLED=0 GOOS=linux go build -o tako-service ./cmd/server",
    },
    {
      id: `${dep.id}-6`,
      timestamp: "10:14:26.310",
      level: "info",
      step: "Docker Engine",
      message: "[5/5] COPY --from=builder /app/tako-service . -> Finished",
    },
    {
      id: `${dep.id}-7`,
      timestamp: "10:14:28.020",
      level: "info",
      step: "Container Lifecycle",
      message: `Stopping existing container tako_${service.slug}_prev (grace period: 10s)`,
    },
    {
      id: `${dep.id}-8`,
      timestamp: "10:14:29.150",
      level: "info",
      step: "Container Lifecycle",
      message: `Created container tako_${service.slug} (image revision: ${dep.commitHash})`,
    },
    {
      id: `${dep.id}-9`,
      timestamp: "10:14:30.820",
      level: "info",
      step: "Health Check",
      message:
        "Probing HTTP GET http://localhost:8443/healthz -> 200 OK (latency: 2ms)",
    },
    {
      id: `${dep.id}-10`,
      timestamp: "10:14:31.000",
      level: "success",
      step: "Deployment Complete",
      message: `Zero-downtime cutover confirmed: Ingress traffic routed to container (${dep.commitHash}).`,
    },
  ]
}
