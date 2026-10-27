"use client"

import * as React from "react"
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  Cpu,
  FileCode2,
  GitBranch,
  Globe,
  HardDrive,
  Layers,
  Plus,
  Server,
  Trash2,
} from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  type SelectOption,
} from "@/components/ui/searchable-select"
import { usePlatformData } from "@/context/platform-data-context"
import { useZodForm } from "@/hooks/use-zod-form"
import { isHttpUrl } from "@/lib/validation"
import { ServiceType } from "@/types/platform"
import { cn } from "@/lib/utils"

const SAMPLE_DOCKERFILE = `FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o tako-service ./cmd/server

FROM alpine:3.20
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/
COPY --from=builder /app/tako-service .
EXPOSE 8080 50051
ENTRYPOINT ["./tako-service"]
`

const SAMPLE_COMPOSE = `services:
  app:
    image: ghcr.io/gettako/tako-api:v1.2.0
    restart: unless-stopped
    ports:
      - "8080:8080"
      - "50051:50051"
    environment:
      - NODE_ENV=production
      - GRPC_PORT=50051
      - DATABASE_URL=postgres://tako:secret@db:5432/takodb
`

// GitHub mock organizations and users
interface MockGitHubAccount {
  username: string
  name: string
  type: "org" | "user"
  avatarText: string
  repos: {
    name: string
    fullName: string
    description: string
    language: string
    defaultBranch: string
    isPrivate?: boolean
  }[]
}

const GITHUB_ACCOUNTS: MockGitHubAccount[] = [
  {
    username: "gettako",
    name: "Tako Platform (Official)",
    type: "org",
    avatarText: "TK",
    repos: [
      {
        name: "tako-edge-proxy",
        fullName: "gettako/tako-edge-proxy",
        description:
          "High throughput reverse proxy, TLS termination, and gRPC balancer",
        language: "Go",
        defaultBranch: "main",
      },
      {
        name: "agent-collector",
        fullName: "gettako/agent-collector",
        description:
          "Ultra-low latency edge metrics and container telemetry daemon",
        language: "Rust",
        defaultBranch: "main",
      },
      {
        name: "api-gateway",
        fullName: "gettako/api-gateway",
        description:
          "High performance edge GraphQL and REST route orchestrator",
        language: "TypeScript",
        defaultBranch: "main",
      },
      {
        name: "worker-queue",
        fullName: "gettako/worker-queue",
        description:
          "Distributed background task queue powered by Redis and NATS",
        language: "Go",
        defaultBranch: "master",
      },
      {
        name: "tako-dashboard",
        fullName: "gettako/tako-dashboard",
        description:
          "Web management console and real-time observability frontend",
        language: "TypeScript",
        defaultBranch: "main",
      },
    ],
  },
  {
    username: "octocat",
    name: "SRE Platform Engineering",
    type: "user",
    avatarText: "OC",
    repos: [
      {
        name: "fastapi-service",
        fullName: "octocat/fastapi-service",
        description:
          "Asynchronous Python microservice with UVicorn and Pydantic",
        language: "Python",
        defaultBranch: "main",
      },
      {
        name: "edge-cache-service",
        fullName: "octocat/edge-cache-service",
        description: "In-memory LRU key-value cache daemon with raft consensus",
        language: "Go",
        defaultBranch: "main",
      },
      {
        name: "event-streamer",
        fullName: "octocat/event-streamer",
        description: "Real-time Kafka event processor and webhook dispatcher",
        language: "TypeScript",
        defaultBranch: "main",
      },
    ],
  },
  {
    username: "acme-systems",
    name: "Acme Infrastructure",
    type: "org",
    avatarText: "AC",
    repos: [
      {
        name: "auth-gateway",
        fullName: "acme-systems/auth-gateway",
        description: "OAuth2 and OIDC zero-trust mutual authentication gateway",
        language: "Go",
        defaultBranch: "main",
      },
      {
        name: "billing-sync",
        fullName: "acme-systems/billing-sync",
        description:
          "Financial transaction settlement engine and invoice generator",
        language: "TypeScript",
        defaultBranch: "main",
      },
    ],
  },
]

// Compose template presets for multi-container deployments
const COMPOSE_TEMPLATES = [
  {
    id: "web-redis",
    title: "Web App + Redis Cache",
    description: "Frontend HTTP service paired with an in-memory Redis layer",
    content: `services:
  web:
    image: ghcr.io/gettako/sample-web:v1.0.0
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - REDIS_URL=redis://cache:6379
    depends_on:
      - cache

  cache:
    image: redis:7.2-alpine
    restart: unless-stopped
    command: redis-server --save 60 1 --loglevel warning
`,
  },
  {
    id: "api-postgres",
    title: "REST API + PostgreSQL",
    description: "Database-backed API service with automated schema migrations",
    content: `services:
  api:
    image: ghcr.io/gettako/sample-api:v2.1.0
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://tako:takosecret@db:5432/production
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_USER=tako
      - POSTGRES_PASSWORD=takosecret
      - POSTGRES_DB=production
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
`,
  },
  {
    id: "microservices",
    title: "Microservices Stack",
    description: "API gateway, background worker, message broker and cache",
    content: SAMPLE_COMPOSE,
  },
]

const RESTART_POLICY_OPTIONS: SelectOption[] = [
  {
    value: "unless-stopped",
    label: "unless-stopped",
    description: "Restart automatically unless manually stopped",
  },
  {
    value: "always",
    label: "always",
    description: "Always restart container upon exit",
  },
  {
    value: "on-failure",
    label: "on-failure",
    description: "Restart only if container exits with non-zero error",
  },
]

const portSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Port must be a number.")
  .refine((value) => {
    const port = Number(value)
    return port >= 1 && port <= 65535
  }, "Port must be between 1 and 65535.")

const serviceSchema = z
  .object({
    type: z.enum(["dockerfile", "docker-compose"]),
    name: z
      .string()
      .trim()
      .min(2, "Service name must be at least 2 characters.")
      .max(63, "Service name must be 63 characters or fewer."),
    slug: z
      .string()
      .trim()
      .min(1, "Identifier is required.")
      .max(63, "Identifier must be 63 characters or fewer.")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use lowercase letters, numbers, and single hyphens only."
      ),
    description: z
      .string()
      .trim()
      .max(240, "Description must be 240 characters or fewer."),
    sourceMode: z.enum(["github", "public_url", "template"]),
    selectedAccount: z.string().trim().min(1, "Select a GitHub account."),
    selectedRepo: z.string().trim().min(1, "Select a repository."),
    gitBranch: z
      .string()
      .trim()
      .min(1, "Branch or ref is required.")
      .max(255, "Branch or ref must be 255 characters or fewer.")
      .regex(
        /^[A-Za-z0-9._/-]+$/,
        "Use letters, numbers, dots, underscores, hyphens, or slashes."
      )
      .refine(
        (value) =>
          !value.startsWith("/") &&
          !value.endsWith("/") &&
          !value.includes(".."),
        "Enter a valid branch or tag name."
      ),
    publicGitUrl: z.string().trim(),
    rootDirectory: z
      .string()
      .trim()
      .min(1, "Build path is required.")
      .refine((value) => value.startsWith("/"), "Path must start with /.")
      .refine(
        (value) => !value.includes(".."),
        "Path cannot contain parent directory segments."
      ),
    selectedComposeTemplate: z
      .string()
      .trim()
      .min(1, "Select a compose template."),
    targetNode: z.string().trim().min(1, "Select a target node."),
    cpuLimit: z
      .number()
      .min(0.1, "CPU limit must be at least 0.1 vCPU.")
      .max(32, "CPU limit must be 32 vCPU or fewer."),
    cpuReservation: z
      .number()
      .min(0.05, "CPU reservation must be at least 0.05 vCPU."),
    memoryLimitMb: z
      .number()
      .int()
      .min(64, "Memory limit must be at least 64 MB.")
      .max(65536, "Memory limit must be 65536 MB or fewer."),
    memoryReservationMb: z
      .number()
      .int()
      .min(32, "Memory reservation must be at least 32 MB."),
    hostPort: portSchema,
    containerPort: portSchema,
    replicas: z
      .number()
      .int()
      .min(1, "Replicas must be at least 1.")
      .max(16, "Replicas must be 16 or fewer."),
    restartPolicy: z.enum(["always", "unless-stopped", "on-failure"]),
    envVars: z
      .array(z.object({ key: z.string(), value: z.string() }))
      .superRefine((variables, context) => {
        const seen = new Set<string>()

        variables.forEach((variable, index) => {
          const key = variable.key.trim()
          if (!key) return

          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
            context.addIssue({
              code: "custom",
              path: [index, "key"],
              message: "Use letters, numbers, and underscores only.",
            })
          }

          const normalized = key.toUpperCase()
          if (seen.has(normalized)) {
            context.addIssue({
              code: "custom",
              path: [index, "key"],
              message: "Duplicate environment variable key.",
            })
          }
          seen.add(normalized)
        })
      }),
  })
  .superRefine((values, context) => {
    if (values.sourceMode === "public_url") {
      if (!values.publicGitUrl) {
        context.addIssue({
          code: "custom",
          path: ["publicGitUrl"],
          message: "Public repository URL is required.",
        })
      } else if (!isHttpUrl(values.publicGitUrl)) {
        context.addIssue({
          code: "custom",
          path: ["publicGitUrl"],
          message: "Enter a valid HTTP or HTTPS repository URL.",
        })
      }
    }

    if (values.cpuReservation > values.cpuLimit) {
      context.addIssue({
        code: "custom",
        path: ["cpuReservation"],
        message: "Reservation cannot exceed the CPU limit.",
      })
    }

    if (values.memoryReservationMb > values.memoryLimitMb) {
      context.addIssue({
        code: "custom",
        path: ["memoryReservationMb"],
        message: "Reservation cannot exceed the memory limit.",
      })
    }
  })

interface GitBranchFieldProps {
  value: string
  onChange: (value: string) => void
}

function GitBranchField({ value, onChange }: GitBranchFieldProps) {
  return (
    <div className="relative">
      <GitBranch className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
      <Input
        placeholder="main"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-8 font-mono text-xs"
      />
    </div>
  )
}

interface CreateServiceContentProps {
  projectId: string
  initialType: ServiceType
  onClose: () => void
}

function CreateServiceContent({
  projectId,
  initialType,
  onClose,
}: CreateServiceContentProps) {
  const { addService, addAuditLog, nodes } = usePlatformData()

  // Active Wizard Step: 1 = Source & Repo, 2 = Node & Specs, 3 = Review & Environment
  const [step, setStep] = React.useState<1 | 2 | 3>(1)

  // Service Core Properties
  const [type, setType] = React.useState<ServiceType>(initialType)
  const defaultRepo = GITHUB_ACCOUNTS[0].repos[0]
  const [name, setName] = React.useState(defaultRepo.name)
  const [slug, setSlug] = React.useState(defaultRepo.name)
  const [description, setDescription] = React.useState(defaultRepo.description)

  // Step 1: Source configuration
  const [sourceMode, setSourceMode] = React.useState<
    "github" | "public_url" | "template"
  >("github")
  const [selectedAccount, setSelectedAccount] = React.useState(
    GITHUB_ACCOUNTS[0].username
  )
  const [selectedRepo, setSelectedRepo] = React.useState(
    GITHUB_ACCOUNTS[0].repos[0].name
  )
  const [gitBranch, setGitBranch] = React.useState("main")
  const [publicGitUrl, setPublicGitUrl] = React.useState(
    "https://github.com/gettako/tako-edge-proxy"
  )
  const [rootDirectory, setRootDirectory] = React.useState("/")
  const [selectedComposeTemplate, setSelectedComposeTemplate] = React.useState(
    COMPOSE_TEMPLATES[0].id
  )
  const [composeYaml, setComposeYaml] = React.useState(
    COMPOSE_TEMPLATES[0].content
  )

  // Step 2: Node & Resource Specifications (CPU/RAM)
  const [targetNode, setTargetNode] = React.useState(
    nodes[0]?.id || "node-master-sg"
  )
  const [cpuLimit, setCpuLimit] = React.useState<number>(1.0)
  const [cpuReservation, setCpuReservation] = React.useState<number>(0.25)
  const [memoryLimitMb, setMemoryLimitMb] = React.useState<number>(1024)
  const [memoryReservationMb, setMemoryReservationMb] =
    React.useState<number>(256)
  const [hostPort, setHostPort] = React.useState("8080")
  const [containerPort, setContainerPort] = React.useState("8080")
  const [replicas, setReplicas] = React.useState<number>(1)
  const [restartPolicy, setRestartPolicy] = React.useState<
    "always" | "unless-stopped" | "on-failure"
  >("unless-stopped")

  // Step 3: Environment variables
  const [envVars, setEnvVars] = React.useState<
    { key: string; value: string }[]
  >([
    { key: "PORT", value: "8080" },
    { key: "NODE_ENV", value: "production" },
  ])
  const { errors, validate, clearError } = useZodForm(serviceSchema)

  // Update repo list when account changes
  const currentAccount =
    GITHUB_ACCOUNTS.find((a) => a.username === selectedAccount) ||
    GITHUB_ACCOUNTS[0]

  const handleAccountChange = (newAccount: string) => {
    setSelectedAccount(newAccount)
    clearError("selectedAccount")
    const acc = GITHUB_ACCOUNTS.find((a) => a.username === newAccount)
    if (acc && acc.repos.length > 0) {
      const firstRepo = acc.repos[0]
      setSelectedRepo(firstRepo.name)
      setGitBranch(firstRepo.defaultBranch)
      setName(firstRepo.name)
      setSlug(firstRepo.name)
      setDescription(firstRepo.description)
    }
  }

  const handleRepoChange = (newRepoName: string) => {
    setSelectedRepo(newRepoName)
    clearError("selectedRepo")
    const repo = currentAccount.repos.find((r) => r.name === newRepoName)
    if (repo) {
      setGitBranch(repo.defaultBranch)
      setName(repo.name)
      setSlug(repo.name)
      setDescription(repo.description)
    }
  }

  const handleNameChange = (val: string) => {
    setName(val)
    clearError("name")
    clearError("slug")
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    )
  }

  const handlePublicUrlChange = (url: string) => {
    setPublicGitUrl(url)
    clearError("publicGitUrl")
    try {
      const parsed = url
        .replace(/\.git$/, "")
        .split("/")
        .filter(Boolean)
      if (parsed.length > 0) {
        const repoName = parsed[parsed.length - 1]
        if (!name || name === "new-service") {
          setName(repoName)
          setSlug(repoName.toLowerCase())
        }
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  const handleAddEnvVar = () => {
    setEnvVars((prev) => [...prev, { key: "", value: "" }])
  }

  const handleUpdateEnvVar = (index: number, key: string, value: string) => {
    setEnvVars((prev) => {
      const next = [...prev]
      next[index] = { key, value }
      return next
    })
    clearError(`envVars.${index}.key`)
  }

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== index))
  }

  const handleTemplateChange = (tmplId: string) => {
    setSelectedComposeTemplate(tmplId)
    clearError("selectedComposeTemplate")
    const tmpl = COMPOSE_TEMPLATES.find((t) => t.id === tmplId)
    if (tmpl) {
      setComposeYaml(tmpl.content)
      if (!name) {
        setName(tmpl.id)
        setSlug(tmpl.id)
        setDescription(tmpl.description)
      }
    }
  }

  const getServiceValues = () => ({
    type,
    name,
    slug,
    description,
    sourceMode,
    selectedAccount,
    selectedRepo,
    gitBranch,
    publicGitUrl,
    rootDirectory,
    selectedComposeTemplate,
    targetNode,
    cpuLimit,
    cpuReservation,
    memoryLimitMb,
    memoryReservationMb,
    hostPort,
    containerPort,
    replicas,
    restartPolicy,
    envVars,
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validate(getServiceValues())
    if (!valid) return

    const gitRepoUrl =
      sourceMode === "github"
        ? `github.com/${selectedAccount}/${selectedRepo}`
        : sourceMode === "public_url"
          ? publicGitUrl.trim()
          : "embedded-compose-manifest"

    const cleanEnvVars = envVars.filter((ev) => ev.key.trim().length > 0)
    const envVarsRecord: Record<string, string> = {}
    cleanEnvVars.forEach((ev) => {
      envVarsRecord[ev.key] = ev.value
    })

    const parsedPorts: number[] = [
      Number.parseInt(containerPort, 10) ||
        Number.parseInt(hostPort, 10) ||
        8080,
    ]

    await addService({
      projectId,
      nodeId: targetNode,
      name: name.trim(),
      slug: slug || name.trim().toLowerCase(),
      type,
      repository: gitRepoUrl || "",
      branch: gitBranch || "main",
      dockerfile:
        type === "dockerfile"
          ? sourceMode === "template"
            ? SAMPLE_DOCKERFILE
            : ""
          : "",
      image: "",
      composeFile:
        type === "docker-compose"
          ? sourceMode === "template"
            ? composeYaml
            : SAMPLE_COMPOSE
          : "",
      ports: parsedPorts,
      domains: [],
      environmentVars: envVarsRecord,
      publishToHost: true,
      limits: {
        cpuCores: Number(cpuLimit) || 1,
        memoryMb: Number(memoryLimitMb) || 512,
      },
      replicas: 1,
    })

    // Record audit log entry
    addAuditLog({
      action: "service.create",
      category: "project",
      actor: { name: "Console Operator", type: "user" },
      target: `${name.trim()} (${type === "dockerfile" ? "Application" : "Compose"})`,
      details: `Created service on node ${targetNode} with ${cpuLimit} vCPU, ${memoryLimitMb}MB RAM limit`,
      status: "success",
    })

    onClose()
  }

  // Account options for SearchableSelect
  const accountOptions: SelectOption[] = GITHUB_ACCOUNTS.map((acc) => ({
    value: acc.username,
    label: `${acc.username} (${acc.name})`,
    description: `${acc.repos.length} repositories available`,
    badge: acc.type === "org" ? "Org" : "User",
  }))

  // Repo options for SearchableSelect
  const repoOptions: SelectOption[] = currentAccount.repos.map((repo) => ({
    value: repo.name,
    label: repo.name,
    description: repo.description,
    badge: repo.language,
  }))

  const selectedNodeObj = nodes.find((n) => n.id === targetNode) || nodes[0]

  return (
    <>
      {/* Modal Top Header with Title and Mode Switcher */}
      <div className="border-b border-border bg-card/60 px-6 py-5">
        <div className="flex flex-col gap-3 pr-10 sm:flex-row sm:items-center sm:justify-between sm:pr-12">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex size-9 items-center justify-center rounded border",
                type === "dockerfile"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              )}
            >
              {type === "dockerfile" ? (
                <FileCode2 className="size-5" />
              ) : (
                <Boxes className="size-5" />
              )}
            </div>
            <DialogHeader className="gap-1 p-0">
              <DialogTitle className="text-base font-semibold text-foreground">
                {type === "dockerfile"
                  ? "Create Application Service"
                  : "Create Docker Compose Stack"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {type === "dockerfile"
                  ? "Containerized workload built via Dockerfile and dispatched through gRPC"
                  : "Multi-container stack orchestrating microservices, networks, and persistent volumes"}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Type Switcher Pills */}
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setType("dockerfile")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-all",
                type === "dockerfile"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileCode2 className="size-3.5" />
              <span>Application</span>
            </button>
            <button
              type="button"
              onClick={() => setType("docker-compose")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-all",
                type === "docker-compose"
                  ? "bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 dark:text-zinc-950"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Boxes className="size-3.5" />
              <span>Compose</span>
            </button>
          </div>
        </div>

        {/* Stepper Wizard Indicator */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={cn(
              "flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs transition-colors",
              step === 1
                ? "bg-muted/80 font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                step === 1
                  ? "bg-primary text-primary-foreground"
                  : step > 1
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {step > 1 ? <Check className="size-3" /> : "1"}
            </span>
            <div className="truncate">
              <div className="truncate">Source & Repository</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (name.trim()) setStep(2)
            }}
            className={cn(
              "flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs transition-colors",
              step === 2
                ? "bg-muted/80 font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                step === 2
                  ? "bg-primary text-primary-foreground"
                  : step > 2
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {step > 2 ? <Check className="size-3" /> : "2"}
            </span>
            <div className="truncate">
              <div className="truncate">Node & Specs (RAM/CPU)</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (name.trim()) setStep(3)
            }}
            className={cn(
              "flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs transition-colors",
              step === 3
                ? "bg-muted/80 font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                step === 3
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              3
            </span>
            <div className="truncate">
              <div className="truncate">Environment & Review</div>
            </div>
          </button>
        </div>
      </div>

      {/* Modal Scrollable Body */}
      <form
        id="create-service-form"
        onSubmit={handleCreate}
        noValidate
        className="max-h-[60vh] overflow-y-auto px-6 py-5"
      >
        {/* STEP 1: SOURCE & REPOSITORY */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Source Method Selection Tabs */}
            <div>
              <FieldLabel className="mb-2 block text-xs font-medium text-foreground">
                Source Method
              </FieldLabel>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  aria-label="Deploy from GitHub Account"
                  onClick={() => setSourceMode("github")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border p-3 text-left transition-all",
                    sourceMode === "github"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  <svg
                    className="size-4 shrink-0 fill-current text-foreground"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      GitHub Account
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Connected organization / user
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  aria-label="Deploy from Public Git URL"
                  onClick={() => setSourceMode("public_url")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border p-3 text-left transition-all",
                    sourceMode === "public_url"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  <Globe className="size-4 shrink-0 text-primary" />
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Public Git URL
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Direct public git repository
                    </div>
                  </div>
                </button>

                {type === "docker-compose" && (
                  <button
                    type="button"
                    aria-label="Deploy from Stack Template"
                    onClick={() => setSourceMode("template")}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md border p-3 text-left transition-all",
                      sourceMode === "template"
                        ? "border-emerald-500 bg-emerald-500/5 text-foreground ring-1 ring-emerald-500"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <Layers className="size-4 shrink-0 text-emerald-500" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">
                        Stack Template
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Preconfigured compose stack
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Source Option: GitHub Account & Repo */}
            {sourceMode === "github" && (
              <div className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field data-invalid={Boolean(errors.selectedAccount)}>
                    <FieldLabel className="text-xs">
                      GitHub Account / Username
                    </FieldLabel>
                    <SearchableSelect
                      value={selectedAccount}
                      onChange={handleAccountChange}
                      options={accountOptions}
                      placeholder="Select GitHub account..."
                      searchPlaceholder="Search accounts..."
                    />
                    <FieldError
                      id="service-account-error"
                      className="text-[11px]"
                    >
                      {errors.selectedAccount}
                    </FieldError>
                  </Field>

                  <Field data-invalid={Boolean(errors.selectedRepo)}>
                    <FieldLabel className="text-xs">Repository</FieldLabel>
                    <SearchableSelect
                      value={selectedRepo}
                      onChange={handleRepoChange}
                      options={repoOptions}
                      placeholder="Select repository..."
                      searchPlaceholder="Search repository..."
                    />
                    <FieldError id="service-repo-error" className="text-[11px]">
                      {errors.selectedRepo}
                    </FieldError>
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field data-invalid={Boolean(errors.gitBranch)}>
                    <FieldLabel className="text-xs">Git Branch</FieldLabel>
                    <GitBranchField
                      value={gitBranch}
                      onChange={(value) => {
                        setGitBranch(value)
                        clearError("gitBranch")
                      }}
                    />
                    <FieldError
                      id="service-branch-error"
                      className="text-[11px]"
                    >
                      {errors.gitBranch}
                    </FieldError>
                  </Field>

                  <Field data-invalid={Boolean(errors.rootDirectory)}>
                    <FieldLabel className="text-xs">
                      Root Directory / Build Path
                    </FieldLabel>
                    <Input
                      placeholder="/"
                      value={rootDirectory}
                      onChange={(e) => {
                        setRootDirectory(e.target.value)
                        clearError("rootDirectory")
                      }}
                      aria-invalid={Boolean(errors.rootDirectory)}
                      aria-describedby={
                        errors.rootDirectory ? "service-root-error" : undefined
                      }
                      className="font-mono text-xs"
                    />
                    <FieldError id="service-root-error" className="text-[11px]">
                      {errors.rootDirectory}
                    </FieldError>
                  </Field>
                </div>
              </div>
            )}

            {/* Source Option: Public Git URL */}
            {sourceMode === "public_url" && (
              <div className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
                <Field data-invalid={Boolean(errors.publicGitUrl)}>
                  <FieldLabel className="text-xs">Public GitHub URL</FieldLabel>
                  <div className="relative">
                    <Globe className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
                    <Input
                      required
                      placeholder="https://github.com/owner/repository"
                      value={publicGitUrl}
                      onChange={(e) => handlePublicUrlChange(e.target.value)}
                      aria-invalid={Boolean(errors.publicGitUrl)}
                      aria-describedby={
                        errors.publicGitUrl
                          ? "service-git-url-error"
                          : undefined
                      }
                      className="pl-8 font-mono text-xs"
                    />
                  </div>
                  <FieldError
                    id="service-git-url-error"
                    className="text-[11px]"
                  >
                    {errors.publicGitUrl}
                  </FieldError>
                  <span className="text-[11px] text-muted-foreground">
                    Enter any publicly accessible Git repository URL.
                  </span>
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field data-invalid={Boolean(errors.gitBranch)}>
                    <FieldLabel className="text-xs">
                      Branch / Tag / Ref
                    </FieldLabel>
                    <GitBranchField
                      value={gitBranch}
                      onChange={(value) => {
                        setGitBranch(value)
                        clearError("gitBranch")
                      }}
                    />
                    <FieldError
                      id="service-public-branch-error"
                      className="text-[11px]"
                    >
                      {errors.gitBranch}
                    </FieldError>
                  </Field>

                  <Field data-invalid={Boolean(errors.rootDirectory)}>
                    <FieldLabel className="text-xs">
                      Build Context Subdirectory
                    </FieldLabel>
                    <Input
                      placeholder="/"
                      value={rootDirectory}
                      onChange={(e) => {
                        setRootDirectory(e.target.value)
                        clearError("rootDirectory")
                      }}
                      aria-invalid={Boolean(errors.rootDirectory)}
                      aria-describedby={
                        errors.rootDirectory
                          ? "service-public-root-error"
                          : undefined
                      }
                      className="font-mono text-xs"
                    />
                    <FieldError
                      id="service-public-root-error"
                      className="text-[11px]"
                    >
                      {errors.rootDirectory}
                    </FieldError>
                  </Field>
                </div>
              </div>
            )}

            {/* Source Option: Compose Template (For Compose mode) */}
            {sourceMode === "template" && type === "docker-compose" && (
              <div className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
                <div>
                  <FieldLabel className="mb-2 block text-xs">
                    Select Compose Stack Template
                  </FieldLabel>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {COMPOSE_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => handleTemplateChange(tmpl.id)}
                        className={cn(
                          "rounded-sm border p-2.5 text-left transition-all",
                          selectedComposeTemplate === tmpl.id
                            ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500"
                            : "border-border bg-card hover:bg-muted/40"
                        )}
                      >
                        <div className="text-xs font-semibold text-foreground">
                          {tmpl.title}
                        </div>
                        <div className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                          {tmpl.description}
                        </div>
                      </button>
                    ))}
                  </div>
                  <FieldError
                    id="service-template-error"
                    className="text-[11px]"
                  >
                    {errors.selectedComposeTemplate}
                  </FieldError>
                </div>
              </div>
            )}

            {/* Service Identity Configuration */}
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel className="text-xs">Service Name</FieldLabel>
                  <Input
                    required
                    placeholder="e.g. auth-gateway"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={
                      errors.name ? "service-name-error" : undefined
                    }
                    className="text-xs font-medium"
                  />
                  <FieldError id="service-name-error" className="text-[11px]">
                    {errors.name}
                  </FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.slug)}>
                  <FieldLabel className="text-xs">Identifier / Slug</FieldLabel>
                  <Input
                    required
                    placeholder="auth-gateway"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value)
                      clearError("slug")
                    }}
                    aria-invalid={Boolean(errors.slug)}
                    aria-describedby={
                      errors.slug ? "service-slug-error" : undefined
                    }
                    className="font-mono text-xs"
                  />
                  <FieldError id="service-slug-error" className="text-[11px]">
                    {errors.slug}
                  </FieldError>
                </Field>
              </div>

              <Field data-invalid={Boolean(errors.description)}>
                <FieldLabel className="text-xs">
                  Description (Optional)
                </FieldLabel>
                <Input
                  placeholder="Brief workload summary for team telemetry..."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    clearError("description")
                  }}
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={
                    errors.description ? "service-description-error" : undefined
                  }
                  className="text-xs"
                />
                <FieldError
                  id="service-description-error"
                  className="text-[11px]"
                >
                  {errors.description}
                </FieldError>
              </Field>
            </div>
          </div>
        )}

        {/* STEP 2: NODE TARGET & HARDWARE SPECIFICATIONS (RAM / CPU) */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Target Node Selection */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <FieldLabel className="text-xs font-medium text-foreground">
                  Target Edge Node
                </FieldLabel>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {nodes.length} nodes connected
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {nodes.map((node) => {
                  const isSelected = targetNode === node.id
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => {
                        setTargetNode(node.id)
                        clearError("targetNode")
                      }}
                      className={cn(
                        "flex flex-col justify-between rounded-md border p-3.5 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 text-foreground shadow-xs ring-1 ring-primary"
                          : "border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Server
                            className={cn(
                              "size-3.5",
                              isSelected
                                ? "text-primary"
                                : "text-muted-foreground"
                            )}
                          />
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {node.name}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "rounded-sm px-1.5 py-0.5 font-mono text-[9px] tracking-wider uppercase",
                            node.role === "master"
                              ? "border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "border border-border bg-zinc-500/10 text-muted-foreground"
                          )}
                        >
                          {node.role}
                        </span>
                      </div>

                      <div className="mt-2 text-[11px] text-muted-foreground">
                        {node.location.name}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 font-mono text-[10px]">
                        <span>CPU: {node.cpuPercent}%</span>
                        <span>RAM: {node.memoryPercent}%</span>
                        <span className="text-emerald-500">
                          {node.grpcLatencyMs}ms
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
              <FieldError
                id="service-target-node-error"
                className="text-[11px]"
              >
                {errors.targetNode}
              </FieldError>
            </div>

            {/* Resource Specifications: CPU & RAM */}
            <div className="space-y-5 rounded-md border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <Cpu className="size-4 text-primary" />
                <span className="text-xs font-semibold tracking-wider text-foreground uppercase">
                  Compute & Memory Allocation
                </span>
              </div>

              {/* CPU Limit & Reservation */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FieldLabel className="text-xs">CPU Limit (vCPU)</FieldLabel>
                  <span className="font-mono text-xs font-semibold text-primary">
                    {cpuLimit} vCPU ({cpuLimit * 1000}m)
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[0.25, 0.5, 1.0, 2.0, 4.0, 8.0].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCpuLimit(preset)}
                      className={cn(
                        "rounded-sm border px-2.5 py-1 font-mono text-xs transition-colors",
                        cpuLimit === preset
                          ? "border-primary bg-primary font-semibold text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {preset} vCPU
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Field data-invalid={Boolean(errors.cpuLimit)}>
                    <FieldLabel className="text-[11px] text-muted-foreground">
                      Custom CPU Limit
                    </FieldLabel>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="32"
                      value={cpuLimit}
                      onChange={(e) => {
                        setCpuLimit(Number.parseFloat(e.target.value) || 0.5)
                        clearError("cpuLimit")
                        clearError("cpuReservation")
                      }}
                      aria-invalid={Boolean(errors.cpuLimit)}
                      aria-describedby={
                        errors.cpuLimit ? "service-cpu-limit-error" : undefined
                      }
                      className="h-8 font-mono text-xs"
                    />
                    <FieldError
                      id="service-cpu-limit-error"
                      className="text-[11px]"
                    >
                      {errors.cpuLimit}
                    </FieldError>
                  </Field>

                  <Field data-invalid={Boolean(errors.cpuReservation)}>
                    <FieldLabel className="text-[11px] text-muted-foreground">
                      Guaranteed Reservation
                    </FieldLabel>
                    <Input
                      type="number"
                      step="0.05"
                      min="0.05"
                      max={cpuLimit}
                      value={cpuReservation}
                      onChange={(e) => {
                        setCpuReservation(
                          Number.parseFloat(e.target.value) || 0.1
                        )
                        clearError("cpuReservation")
                      }}
                      aria-invalid={Boolean(errors.cpuReservation)}
                      aria-describedby={
                        errors.cpuReservation
                          ? "service-cpu-reservation-error"
                          : undefined
                      }
                      className="h-8 font-mono text-xs"
                    />
                    <FieldError
                      id="service-cpu-reservation-error"
                      className="text-[11px]"
                    >
                      {errors.cpuReservation}
                    </FieldError>
                  </Field>
                </div>
              </div>

              {/* RAM / Memory Limit & Reservation */}
              <div className="space-y-3 border-t border-border/40 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="size-3.5 text-emerald-500" />
                    <FieldLabel className="text-xs">
                      RAM Limit (Memory)
                    </FieldLabel>
                  </div>
                  <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {memoryLimitMb >= 1024
                      ? `${(memoryLimitMb / 1024).toFixed(1)} GB (${memoryLimitMb} MB)`
                      : `${memoryLimitMb} MB`}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "256 MB", val: 256 },
                    { label: "512 MB", val: 512 },
                    { label: "1 GB", val: 1024 },
                    { label: "2 GB", val: 2048 },
                    { label: "4 GB", val: 4096 },
                    { label: "8 GB", val: 8192 },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setMemoryLimitMb(item.val)}
                      className={cn(
                        "rounded-sm border px-2.5 py-1 font-mono text-xs transition-colors",
                        memoryLimitMb === item.val
                          ? "border-emerald-500 bg-emerald-500 font-semibold text-zinc-950"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Field data-invalid={Boolean(errors.memoryLimitMb)}>
                    <FieldLabel className="text-[11px] text-muted-foreground">
                      Custom Memory Limit (MB)
                    </FieldLabel>
                    <Input
                      type="number"
                      step="64"
                      min="64"
                      max="65536"
                      value={memoryLimitMb}
                      onChange={(e) => {
                        setMemoryLimitMb(
                          Number.parseInt(e.target.value, 10) || 512
                        )
                        clearError("memoryLimitMb")
                        clearError("memoryReservationMb")
                      }}
                      aria-invalid={Boolean(errors.memoryLimitMb)}
                      aria-describedby={
                        errors.memoryLimitMb
                          ? "service-memory-limit-error"
                          : undefined
                      }
                      className="h-8 font-mono text-xs"
                    />
                    <FieldError
                      id="service-memory-limit-error"
                      className="text-[11px]"
                    >
                      {errors.memoryLimitMb}
                    </FieldError>
                  </Field>

                  <Field data-invalid={Boolean(errors.memoryReservationMb)}>
                    <FieldLabel className="text-[11px] text-muted-foreground">
                      Memory Reservation (MB)
                    </FieldLabel>
                    <Input
                      type="number"
                      step="64"
                      min="32"
                      max={memoryLimitMb}
                      value={memoryReservationMb}
                      onChange={(e) => {
                        setMemoryReservationMb(
                          Number.parseInt(e.target.value, 10) || 128
                        )
                        clearError("memoryReservationMb")
                      }}
                      aria-invalid={Boolean(errors.memoryReservationMb)}
                      aria-describedby={
                        errors.memoryReservationMb
                          ? "service-memory-reservation-error"
                          : undefined
                      }
                      className="h-8 font-mono text-xs"
                    />
                    <FieldError
                      id="service-memory-reservation-error"
                      className="text-[11px]"
                    >
                      {errors.memoryReservationMb}
                    </FieldError>
                  </Field>
                </div>
              </div>

              {/* Networking: Ports, Replicas & Restart Policy */}
              <div className="grid grid-cols-1 gap-4 border-t border-border/40 pt-2 sm:grid-cols-4">
                <Field data-invalid={Boolean(errors.hostPort)}>
                  <FieldLabel className="text-xs">Host Port</FieldLabel>
                  <Input
                    type="number"
                    placeholder="8080"
                    value={hostPort}
                    onChange={(e) => {
                      setHostPort(e.target.value)
                      clearError("hostPort")
                    }}
                    aria-invalid={Boolean(errors.hostPort)}
                    aria-describedby={
                      errors.hostPort ? "service-host-port-error" : undefined
                    }
                    className="h-8 font-mono text-xs"
                  />
                  <FieldError
                    id="service-host-port-error"
                    className="text-[11px]"
                  >
                    {errors.hostPort}
                  </FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.containerPort)}>
                  <FieldLabel className="text-xs">Container Port</FieldLabel>
                  <Input
                    type="number"
                    placeholder="8080"
                    value={containerPort}
                    onChange={(e) => {
                      setContainerPort(e.target.value)
                      clearError("containerPort")
                    }}
                    aria-invalid={Boolean(errors.containerPort)}
                    aria-describedby={
                      errors.containerPort
                        ? "service-container-port-error"
                        : undefined
                    }
                    className="h-8 font-mono text-xs"
                  />
                  <FieldError
                    id="service-container-port-error"
                    className="text-[11px]"
                  >
                    {errors.containerPort}
                  </FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.replicas)}>
                  <FieldLabel className="text-xs">Replicas</FieldLabel>
                  <Input
                    type="number"
                    min="1"
                    max="16"
                    value={replicas}
                    onChange={(e) => {
                      setReplicas(Number.parseInt(e.target.value, 10) || 1)
                      clearError("replicas")
                    }}
                    aria-invalid={Boolean(errors.replicas)}
                    aria-describedby={
                      errors.replicas ? "service-replicas-error" : undefined
                    }
                    className="h-8 font-mono text-xs"
                  />
                  <FieldError
                    id="service-replicas-error"
                    className="text-[11px]"
                  >
                    {errors.replicas}
                  </FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.restartPolicy)}>
                  <FieldLabel className="text-xs">Restart Policy</FieldLabel>
                  <SearchableSelect
                    value={restartPolicy}
                    onChange={(val) => {
                      setRestartPolicy(
                        val as "always" | "unless-stopped" | "on-failure"
                      )
                      clearError("restartPolicy")
                    }}
                    aria-label="Restart Policy"
                    options={RESTART_POLICY_OPTIONS}
                    placeholder="Select restart policy..."
                    searchPlaceholder="Search restart policy..."
                  />
                  <FieldError
                    id="service-restart-policy-error"
                    className="text-[11px]"
                  >
                    {errors.restartPolicy}
                  </FieldError>
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: ENVIRONMENT VARIABLES & REVIEW */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Environment Variables Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <FieldLabel className="text-xs font-semibold text-foreground">
                    Environment Variables
                  </FieldLabel>
                  <p className="text-[11px] text-muted-foreground">
                    Runtime configuration injected directly into the container
                    process.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddEnvVar}
                  className="h-7 gap-1 px-2.5 text-xs font-medium"
                >
                  <Plus className="size-3" />
                  <span>Add Variable</span>
                </Button>
              </div>

              <div className="space-y-2">
                {envVars.map((ev, index) => {
                  const keyError = errors[`envVars.${index}.key`]
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="KEY_NAME"
                          value={ev.key}
                          onChange={(e) =>
                            handleUpdateEnvVar(index, e.target.value, ev.value)
                          }
                          aria-invalid={Boolean(keyError)}
                          aria-describedby={
                            keyError
                              ? `service-env-key-${index}-error`
                              : undefined
                          }
                          className="h-8 flex-1 font-mono text-xs uppercase"
                        />
                        <span className="font-mono text-xs text-muted-foreground">
                          =
                        </span>
                        <Input
                          placeholder="Value"
                          value={ev.value}
                          onChange={(e) =>
                            handleUpdateEnvVar(index, ev.key, e.target.value)
                          }
                          className="h-8 flex-1 font-mono text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRemoveEnvVar(index)}
                          className="size-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">Delete variable</span>
                        </Button>
                      </div>
                      <FieldError
                        id={`service-env-key-${index}-error`}
                        className="text-[11px]"
                      >
                        {keyError}
                      </FieldError>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Deployment Checklist Review */}
            <div className="space-y-3 rounded-md border border-border bg-card p-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-xs font-semibold tracking-wider text-foreground uppercase">
                  Service Configuration Review
                </span>
                <span className="rounded-sm bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  Ready to Save
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                <div>
                  <span className="text-muted-foreground">Service Name:</span>
                  <span className="ml-2 font-semibold text-foreground">
                    {name || "[UNTITLED]"}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">Workload Type:</span>
                  <span className="ml-2 font-mono text-foreground uppercase">
                    {type === "dockerfile"
                      ? "Application (Dockerfile)"
                      : "Docker Compose"}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">Source:</span>
                  <span className="ml-2 font-mono text-[11px] text-foreground">
                    {sourceMode === "github"
                      ? `${selectedAccount}/${selectedRepo} (${gitBranch})`
                      : sourceMode === "public_url"
                        ? `${publicGitUrl} (${gitBranch})`
                        : `Template: ${selectedComposeTemplate}`}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">Target Node:</span>
                  <span className="ml-2 font-mono text-foreground">
                    {selectedNodeObj.name} ({selectedNodeObj.ipAddress})
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">CPU Allocation:</span>
                  <span className="ml-2 font-mono text-foreground">
                    Limit {cpuLimit} vCPU / Res {cpuReservation} vCPU
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    Memory Allocation:
                  </span>
                  <span className="ml-2 font-mono text-foreground">
                    Limit {memoryLimitMb} MB / Res {memoryReservationMb} MB
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">Exposed Port:</span>
                  <span className="ml-2 font-mono text-foreground">
                    {hostPort}:{containerPort} (tcp)
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">Restart Policy:</span>
                  <span className="ml-2 font-mono text-foreground">
                    {restartPolicy}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Modal Footer Controls */}
      <DialogFooter className="flex items-center justify-between border-t border-border bg-card/40 px-6 py-3.5 sm:justify-between">
        <div className="flex items-center gap-2">
          <DialogClose
            render={
              <Button variant="outline" size="sm" className="text-xs">
                Cancel
              </Button>
            }
          />
          {step > 1 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setStep((s) => (s - 1) as 1 | 2)}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {step < 3 ? (
            <Button
              key="next-step"
              type="button"
              size="sm"
              onClick={() => {
                if (!validate(getServiceValues())) return
                setStep((s) => (s + 1) as 2 | 3)
              }}
              className="gap-1.5 text-xs"
            >
              <span>
                Next: {step === 1 ? "Node & Specs" : "Environment & Review"}
              </span>
              <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button
              key="save-service"
              type="submit"
              form="create-service-form"
              size="sm"
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              <span>Save Service</span>
            </Button>
          )}
        </div>
      </DialogFooter>
    </>
  )
}

export function CreateServiceDialog({
  projectId,
  children,
  open,
  onOpenChange,
  initialType = "dockerfile",
}: {
  projectId: string
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialType?: ServiceType
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      {/* Widen modal as explicitly requested (sm:max-w-3xl md:max-w-4xl) */}
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl md:max-w-4xl">
        {isOpen && (
          <CreateServiceContent
            key={`${projectId}-${initialType}`}
            projectId={projectId}
            initialType={initialType}
            onClose={() => setIsOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
