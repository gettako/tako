"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  GitBranchIcon,
  GithubLogoIcon,
  HardDrivesIcon,
  CpuIcon,
  CheckIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CircleNotchIcon,
  MagnifyingGlassIcon,
  FileCodeIcon,
  GlobeIcon,
  WarningCircleIcon,
  DatabaseIcon,
  EyeIcon,
  EyeSlashIcon,
  CopyIcon,
  ArrowsClockwiseIcon,
  ArrowSquareOutIcon,
} from "@phosphor-icons/react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  api,
  type GitHubRepo,
  type GitHubBranch,
  type GitHubConnection,
  type Server,
  ApiError,
} from "@/lib/api"
import { cn } from "@/lib/utils"

function generateRandomPassword(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
  let pass = ""
  for (let i = 0; i < 20; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pass
}

export interface CreateServiceWizardProps {
  projectId: string
  initialTab?: "app" | "database" | "compose"
  onSuccess?: (serviceId: string) => void
  onCancel?: () => void
}

type WizardStep = 1 | 2 | 3 | 4
type ServiceCategory = "app" | "database" | "compose"

export function CreateServiceWizard({
  projectId,
  initialTab = "app",
  onSuccess,
  onCancel,
}: CreateServiceWizardProps) {
  const router = useRouter()

  const [category, setCategory] = React.useState<ServiceCategory>(initialTab)
  const [currentStep, setCurrentStep] = React.useState<WizardStep>(1)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [generalError, setGeneralError] = React.useState<string | null>(null)

  // Step 1: Source
  const [connections, setConnections] = React.useState<GitHubConnection[]>([])
  const [selectedConnectionId, setSelectedConnectionId] =
    React.useState<string>("")
  const [repos, setRepos] = React.useState<GitHubRepo[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = React.useState(true)
  const [repoSearch, setRepoSearch] = React.useState("")
  const [selectedRepo, setSelectedRepo] = React.useState<GitHubRepo | null>(
    null
  )
  const [customGitUrl, setCustomGitUrl] = React.useState("")
  const [useCustomGit, setUseCustomGit] = React.useState(false)

  // Step 2: Build config
  const [branches, setBranches] = React.useState<GitHubBranch[]>([])
  const [isLoadingBranches, setIsLoadingBranches] = React.useState(false)
  const [selectedBranch, setSelectedBranch] = React.useState("main")
  const [dockerfilePath, setDockerfilePath] = React.useState("Dockerfile")
  const [buildContext, setBuildContext] = React.useState(".")

  // Step 3: Server
  const [servers, setServers] = React.useState<Server[]>([])
  const [isLoadingServers, setIsLoadingServers] = React.useState(true)
  const [selectedServerId, setSelectedServerId] = React.useState<string>("")

  // Step 4: Metadata (App)
  const [serviceName, setServiceName] = React.useState("")
  const [internalPort, setInternalPort] = React.useState("3000")
  const [healthCheckPath, setHealthCheckPath] = React.useState("/healthz")
  const [appVolumeName, setAppVolumeName] = React.useState("")
  const [appVolumeMount, setAppVolumeMount] = React.useState("")
  const [preDeployCommand, setPreDeployCommand] = React.useState("")
  const [postDeployCommand, setPostDeployCommand] = React.useState("")

  // Database Template State
  const [dbEngine, setDbEngine] = React.useState<
    "postgres" | "mysql" | "redis"
  >("postgres")
  const [dbVersion, setDbVersion] = React.useState("16-alpine")
  const [dbServiceName, setDbServiceName] = React.useState("acme-postgres")
  const [dbName, setDbName] = React.useState("app_db")
  const [dbUser, setDbUser] = React.useState("postgres")
  const [dbPassword, setDbPassword] = React.useState(() =>
    generateRandomPassword()
  )
  const [showDbPassword, setShowDbPassword] = React.useState(false)

  // Compose Template State
  const [composeSourceMode, setComposeSourceMode] = React.useState<
    "inline" | "git"
  >("inline")
  const [composeServiceName, setComposeServiceName] =
    React.useState("my-compose-stack")
  const [composeYamlContent, setComposeYamlContent] =
    React.useState(`version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: secret
`)
  const [composeFilePath, setComposeFilePath] =
    React.useState("docker-compose.yml")
  const [isValidatingCompose, setIsValidatingCompose] = React.useState(false)
  const [composeValidation, setComposeValidation] = React.useState<{
    valid?: boolean
    errors?: string[]
    services?: Array<{ name: string; image?: string; ports?: string[] }>
  } | null>(null)

  const handleValidateCompose = async (content: string) => {
    if (!content.trim()) {
      setComposeValidation(null)
      return
    }
    setIsValidatingCompose(true)
    try {
      const res = await api.services.validateCompose({
        compose_content: content,
      })
      setComposeValidation(res)
    } catch {
      setComposeValidation({
        valid: false,
        errors: ["Network or validation error."],
      })
    } finally {
      setIsValidatingCompose(false)
    }
  }

  // Handle changing selected GitHub account connection
  const handleConnectionChange = async (connId: string) => {
    setSelectedConnectionId(connId)
    setSelectedRepo(null)
    setBranches([])
    setIsLoadingRepos(true)
    try {
      const reposData = await api.github.listConnectionRepos(connId)
      setRepos(reposData)
    } catch {
      const reposData = await api.github.listRepos().catch(() => [])
      setRepos(reposData)
    } finally {
      setIsLoadingRepos(false)
    }
  }

  // Load connections, repos, and servers on mount
  React.useEffect(() => {
    let isMounted = true

    async function fetchInitialData() {
      setIsLoadingRepos(true)
      setIsLoadingServers(true)
      try {
        const [connsData, serversData] = await Promise.all([
          api.github.listConnections().catch(() => []),
          api.servers.list().catch(() => []),
        ])
        if (isMounted) {
          setConnections(connsData)
          setServers(serversData)
          if (serversData.length > 0) {
            setSelectedServerId(serversData[0].id)
          }

          let initialRepos: GitHubRepo[] = []
          if (connsData.length > 0) {
            const firstConnId = connsData[0].id
            setSelectedConnectionId(firstConnId)
            initialRepos = await api.github
              .listConnectionRepos(firstConnId)
              .catch(() => api.github.listRepos().catch(() => []))
          } else {
            initialRepos = await api.github.listRepos().catch(() => [])
          }
          setRepos(initialRepos)
        }
      } catch (err) {
        if (isMounted) {
          setGeneralError(
            "Failed to load initial repository or server options."
          )
        }
      } finally {
        if (isMounted) {
          setIsLoadingRepos(false)
          setIsLoadingServers(false)
        }
      }
    }

    fetchInitialData()
    return () => {
      isMounted = false
    }
  }, [])

  // Auto-fill service name when repo is picked
  React.useEffect(() => {
    if (selectedRepo && !useCustomGit) {
      setServiceName(selectedRepo.name)
      setSelectedBranch(selectedRepo.default_branch || "main")

      // Fetch branches for repo under selected connection (or default)
      const [owner, repoName] = selectedRepo.full_name.split("/")
      if (owner && repoName) {
        setIsLoadingBranches(true)
        const fetchBranches = selectedConnectionId
          ? api.github.listConnectionBranches(
              selectedConnectionId,
              owner,
              repoName
            )
          : api.github.listBranches(owner, repoName)
        fetchBranches
          .then((branchList) => {
            setBranches(branchList)
            if (branchList.length > 0) {
              const defaultOrFirst =
                branchList.find(
                  (b) => b.name === selectedRepo.default_branch
                ) || branchList[0]
              setSelectedBranch(defaultOrFirst.name)
            }
          })
          .catch(() => {
            setBranches([{ name: "main", commit_sha: "", protected: false }])
          })
          .finally(() => {
            setIsLoadingBranches(false)
          })
      }
    } else if (useCustomGit && customGitUrl) {
      const parts = customGitUrl.split("/")
      const last = parts[parts.length - 1]?.replace(/\.git$/, "")
      if (last) {
        setServiceName(last)
      }
    }
  }, [selectedRepo, useCustomGit, customGitUrl, selectedConnectionId])

  // Validation per step
  const canGoNextFromStep1 = useCustomGit
    ? customGitUrl.trim().length > 3
    : selectedRepo !== null

  const canGoNextFromStep2 =
    selectedBranch.trim().length > 0 && dockerfilePath.trim().length > 0

  const canGoNextFromStep3 =
    serviceName.trim().length >= 2 &&
    !isNaN(Number(internalPort)) &&
    Number(internalPort) >= 1 &&
    Number(internalPort) <= 65535

  const canSubmit =
    canGoNextFromStep3 && selectedServerId.trim().length > 0

  const selectedServer = React.useMemo(
    () => servers.find((s) => s.id === selectedServerId),
    [servers, selectedServerId]
  )

  const canJumpToStep = (targetStep: number) => {
    if (targetStep === currentStep) return true
    if (targetStep === 1) return true
    if (targetStep === 2) return canGoNextFromStep1
    if (targetStep === 3) return canGoNextFromStep1 && canGoNextFromStep2
    if (targetStep === 4) return canGoNextFromStep1 && canGoNextFromStep2 && canGoNextFromStep3
    return false
  }

  const handleNext = () => {
    setGeneralError(null)
    if (currentStep === 1 && canGoNextFromStep1) setCurrentStep(2)
    else if (currentStep === 2 && canGoNextFromStep2) setCurrentStep(3)
    else if (currentStep === 3 && canGoNextFromStep3) setCurrentStep(4)
  }

  const handleBack = () => {
    setGeneralError(null)
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep)
    }
  }

  const handleEngineChange = (engine: "postgres" | "mysql" | "redis") => {
    setDbEngine(engine)
    if (engine === "postgres") {
      setDbVersion("16-alpine")
      setDbServiceName("acme-postgres")
      setDbName("app_db")
      setDbUser("postgres")
    } else if (engine === "mysql") {
      setDbVersion("8.4")
      setDbServiceName("acme-mysql")
      setDbName("app_db")
      setDbUser("root")
    } else if (engine === "redis") {
      setDbVersion("7-alpine")
      setDbServiceName("acme-redis")
      setDbName("")
      setDbUser("")
    }
  }

  const canSubmitDatabase =
    dbServiceName.trim().length >= 2 &&
    selectedServerId.trim().length > 0 &&
    dbPassword.trim().length >= 6

  const handleDatabaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmitDatabase) return

    setIsSubmitting(true)
    setGeneralError(null)

    const mountPath =
      dbEngine === "mysql"
        ? "/var/lib/mysql"
        : dbEngine === "redis"
          ? "/data"
          : "/var/lib/postgresql/data"

    const volName = `tako_vol_${dbServiceName.trim().replace(/[^a-zA-Z0-9_-]/g, "_")}_data`

    try {
      const port =
        dbEngine === "mysql" ? 3306 : dbEngine === "redis" ? 6379 : 5432
      const createdService = await api.services.create({
        project_id: projectId,
        server_id: selectedServerId,
        name: dbServiceName.trim(),
        service_type: "database",
        database_engine: dbEngine,
        database_version: dbVersion,
        database_name:
          dbEngine === "redis" ? undefined : dbName.trim() || undefined,
        database_user:
          dbEngine === "redis" ? undefined : dbUser.trim() || undefined,
        database_password: dbPassword.trim(),
        volume_name: volName,
        volume_mount_path: mountPath,
        internal_port: port,
        dockerfile_path: "",
        health_check_path: "",
      })

      if (onSuccess) {
        onSuccess(createdService.id)
      }

      router.push(`/projects/${projectId}/services/${createdService.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setGeneralError(err.message)
      } else if (err instanceof Error) {
        setGeneralError(err.message)
      } else {
        setGeneralError("Failed to provision database service.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmitCompose =
    composeServiceName.trim().length >= 2 &&
    selectedServerId.trim().length > 0 &&
    (composeSourceMode === "inline"
      ? composeYamlContent.trim().length > 0
      : selectedRepo !== null || customGitUrl.trim().length > 0)

  const handleComposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmitCompose) return

    setIsSubmitting(true)
    setGeneralError(null)

    const repoString = useCustomGit
      ? customGitUrl.trim()
      : selectedRepo?.full_name || ""

    try {
      const createdService = await api.services.create({
        project_id: projectId,
        server_id: selectedServerId,
        name: composeServiceName.trim(),
        service_type: "compose",
        compose_file_content:
          composeSourceMode === "inline" ? composeYamlContent : undefined,
        compose_file_path:
          composeSourceMode === "git"
            ? composeFilePath.trim() || "docker-compose.yml"
            : undefined,
        repository: composeSourceMode === "git" ? repoString : "inline/compose",
        branch: composeSourceMode === "git" ? selectedBranch.trim() : "main",
        dockerfile_path: "Dockerfile",
        internal_port: 80,
        health_check_path: "/healthz",
      })

      // Trigger initial deployment
      await api.services
        .createDeployment(createdService.id, {
          branch: composeSourceMode === "git" ? selectedBranch.trim() : "main",
        })
        .catch(() => {})

      if (onSuccess) {
        onSuccess(createdService.id)
      }

      router.push(`/projects/${projectId}/services/${createdService.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setGeneralError(err.message)
      } else if (err instanceof Error) {
        setGeneralError(err.message)
      } else {
        setGeneralError("Failed to deploy Docker Compose stack.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (category === "database") {
      await handleDatabaseSubmit(e)
      return
    }
    if (category === "compose") {
      await handleComposeSubmit(e)
      return
    }

    if (category === "app" && currentStep < 4) {
      handleNext()
      return
    }

    if (!canSubmit) return

    setIsSubmitting(true)
    setGeneralError(null)

    const repoString = useCustomGit
      ? customGitUrl.trim()
      : selectedRepo?.full_name || "unknown/repo"

    try {
      // 1. Create service
      const createdService = await api.services.create({
        project_id: projectId,
        server_id: selectedServerId,
        name: serviceName.trim(),
        repository: repoString,
        branch: selectedBranch.trim(),
        dockerfile_path: dockerfilePath.trim(),
        internal_port: parseInt(internalPort, 10),
        health_check_path: healthCheckPath.trim() || "/healthz",
        volume_name: appVolumeName.trim() || undefined,
        volume_mount_path: appVolumeMount.trim() || undefined,
        pre_deploy_command: preDeployCommand.trim() || undefined,
        post_deploy_command: postDeployCommand.trim() || undefined,
        github_connection_id: useCustomGit
          ? undefined
          : selectedConnectionId || undefined,
      })

      // 2. Trigger initial deployment
      await api.services
        .createDeployment(createdService.id, {
          branch: selectedBranch.trim(),
        })
        .catch(() => {
          // If initial deployment fails or is queued, we still navigate to deployments view
        })

      if (onSuccess) {
        onSuccess(createdService.id)
      }

      router.push(
        `/projects/${projectId}/services/${createdService.id}/deployments`
      )
    } catch (err) {
      if (err instanceof ApiError) {
        setGeneralError(err.message)
      } else if (err instanceof Error) {
        setGeneralError(err.message)
      } else {
        setGeneralError("Failed to create service. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredRepos = React.useMemo(() => {
    const q = repoSearch.toLowerCase().trim()
    if (!q) return repos
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q)
    )
  }, [repos, repoSearch])

  const stepLabels = [
    { num: 1, title: "Source" },
    { num: 2, title: "Build" },
    { num: 3, title: "Details" },
    { num: 4, title: "Server" },
  ]

  const calculatedURI = React.useMemo(() => {
    const sName = dbServiceName.trim() || "db"
    const pass = dbPassword.trim() || "password"
    if (dbEngine === "postgres") {
      return `postgres://${dbUser || "postgres"}:${pass}@tako-${sName}:5432/${dbName || "app_db"}`
    } else if (dbEngine === "mysql") {
      return `mysql://${dbUser || "root"}:${pass}@tako-${sName}:3306/${dbName || "app_db"}`
    } else if (dbEngine === "redis") {
      return `redis://default:${pass}@tako-${sName}:6379`
    }
    return ""
  }, [dbEngine, dbServiceName, dbUser, dbPassword, dbName])

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Wizard Header */}
      <DialogHeader>
        <DialogTitle>Create New Service</DialogTitle>
        <DialogDescription>
          Configure and deploy an application, database, or docker-compose
          service.
        </DialogDescription>
      </DialogHeader>

      {/* Category Switcher Tabs */}
      <div className="grid grid-cols-3 gap-1.5 rounded-md border border-border bg-muted/60 p-1">
        <button
          type="button"
          onClick={() => {
            setCategory("app")
            setGeneralError(null)
          }}
          className={cn(
            "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-sm px-3 text-xs font-medium transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            category === "app"
              ? "border border-border bg-background font-semibold text-foreground shadow-none"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FileCodeIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>Application (Git)</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setCategory("database")
            setGeneralError(null)
          }}
          className={cn(
            "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-sm px-3 text-xs font-medium transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            category === "database"
              ? "border border-border bg-background font-semibold text-foreground shadow-none"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <DatabaseIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>Database Template</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setCategory("compose")
            setGeneralError(null)
          }}
          className={cn(
            "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-sm px-3 text-xs font-medium transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            category === "compose"
              ? "border border-border bg-background font-semibold text-foreground shadow-none"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <HardDrivesIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>Docker Compose</span>
        </button>
      </div>

      {/* Step pills for Application Mode */}
      {category === "app" && (
        <div className="flex items-center gap-2 border-y border-border py-2 text-xs">
          {stepLabels.map((s) => {
            const isActive = currentStep === s.num
            const isCompleted = currentStep > s.num
            const isClickable = canJumpToStep(s.num)
            return (
              <button
                key={s.num}
                type="button"
                disabled={!isClickable || isSubmitting}
                onClick={() => {
                  if (isClickable && !isSubmitting) {
                    setGeneralError(null)
                    setCurrentStep(s.num as WizardStep)
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors select-none",
                  isActive
                    ? "border-foreground bg-foreground font-semibold text-background cursor-default"
                    : isCompleted
                      ? "border-border bg-muted/60 text-foreground hover:bg-muted hover:border-foreground/40 cursor-pointer"
                      : isClickable
                        ? "border-border/60 bg-transparent text-muted-foreground hover:text-foreground hover:border-border cursor-pointer"
                        : "border-border/30 bg-transparent text-muted-foreground/40 cursor-not-allowed"
                )}
                aria-current={isActive ? "step" : undefined}
              >
                <span>{s.num}.</span>
                <span>{s.title}</span>
                {isCompleted && (
                  <CheckIcon className="size-3 text-emerald-600" />
                )}
              </button>
            )
          })}
        </div>
      )}

      {generalError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <WarningCircleIcon className="size-4 shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {category === "app" && (
        <>
          {/* STEP 1: SOURCE CODE */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Select connected GitHub repository or provide Git URL
                </span>
                <button
                  type="button"
                  onClick={() => setUseCustomGit(!useCustomGit)}
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  {useCustomGit ? "Choose from GitHub" : "Use custom Git URL"}
                </button>
              </div>

              {useCustomGit ? (
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="custom-git-url"
                    className="text-xs font-medium text-foreground"
                  >
                    Git Repository URL{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="custom-git-url"
                    placeholder="https://github.com/organization/repository.git"
                    value={customGitUrl}
                    onChange={(e) => setCustomGitUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        if (canGoNextFromStep1) handleNext()
                      }
                    }}
                    autoFocus
                  />
                  <p className="text-2xs text-muted-foreground">
                    Public repositories or repositories accessible via standard
                    deploy keys.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {connections.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="github-account-select"
                          className="text-xs font-medium text-foreground"
                        >
                          Select GitHub Account
                        </label>
                        {(() => {
                          const appConn = connections.find((c) => c.app_slug)
                          if (!appConn?.app_slug) return null
                          return (
                            <a
                              href={`https://github.com/apps/${appConn.app_slug}/installations/new`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground"
                            >
                              <span>+ Install on another org</span>
                              <ArrowSquareOutIcon className="size-3" />
                            </a>
                          )
                        })()}
                      </div>
                      <Select
                        value={selectedConnectionId}
                        onValueChange={(val) => {
                          if (val) handleConnectionChange(val)
                        }}
                      >
                        <SelectTrigger
                          id="github-account-select"
                          className="w-full text-xs"
                        >
                          <SelectValue placeholder="Select GitHub Account" />
                        </SelectTrigger>
                        <SelectContent>
                          {connections.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} (
                              {c.account_name
                                ? `@${c.account_name}`
                                : c.auth_type.toUpperCase()}
                              )
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Filter repositories..."
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      className="pl-9"
                      aria-label="Filter repositories"
                    />
                  </div>

                  {isLoadingRepos ? (
                    <div className="flex items-center justify-center p-6 text-xs text-muted-foreground">
                      <CircleNotchIcon className="mr-2 size-4 animate-spin" />
                      <span>Loading GitHub repositories...</span>
                    </div>
                  ) : filteredRepos.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      No repositories found. Check your search or enter a custom
                      Git URL.
                    </div>
                  ) : (
                    <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border bg-card">
                      {filteredRepos.map((repo) => {
                        const isSelected = selectedRepo?.id === repo.id
                        return (
                          <button
                            key={repo.id}
                            type="button"
                            onClick={() => setSelectedRepo(repo)}
                            className={cn(
                              "flex w-full items-center justify-between p-3 text-left text-xs transition-colors hover:bg-muted/40",
                              isSelected && "bg-muted/70 font-medium"
                            )}
                            aria-pressed={isSelected}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <GithubLogoIcon className="size-4 shrink-0 text-muted-foreground" />
                              <div className="truncate">
                                <span className="font-semibold text-foreground">
                                  {repo.name}
                                </span>
                                <span className="ml-1.5 font-mono text-2xs text-muted-foreground">
                                  {repo.full_name}
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <CheckIcon className="size-4 shrink-0 text-primary" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: BUILD CONFIGURATION */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="branch-select"
                  className="text-xs font-medium text-foreground"
                >
                  Git Branch <span className="text-destructive">*</span>
                </label>
                {isLoadingBranches ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                    <CircleNotchIcon className="size-3.5 animate-spin" />
                    <span>Loading branches...</span>
                  </div>
                ) : branches.length > 0 ? (
                  <Select
                    value={selectedBranch}
                    onValueChange={(v) => v && setSelectedBranch(v)}
                  >
                    <SelectTrigger id="branch-select" className="w-full">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.name} value={b.name}>
                          {b.name}
                          {b.protected ? " (protected)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="branch-select"
                    placeholder="main"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                  />
                )}
                <p className="text-2xs text-muted-foreground">
                  The branch to track for builds and deployments.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="dockerfile-path"
                  className="text-xs font-medium text-foreground"
                >
                  Dockerfile Path <span className="text-destructive">*</span>
                </label>
                <Input
                  id="dockerfile-path"
                  placeholder="Dockerfile"
                  value={dockerfilePath}
                  onChange={(e) => setDockerfilePath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (canGoNextFromStep2) handleNext()
                    }
                  }}
                />
                <p className="text-2xs text-muted-foreground">
                  Relative path to the Dockerfile in the repository root.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="build-context"
                  className="text-xs font-medium text-foreground"
                >
                  Build Context
                </label>
                <Input
                  id="build-context"
                  placeholder="."
                  value={buildContext}
                  onChange={(e) => setBuildContext(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (canGoNextFromStep2) handleNext()
                    }
                  }}
                />
                <p className="text-2xs text-muted-foreground">
                  Docker build directory context (default is repository root
                  `.`).
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: SERVICE METADATA & CONFIGURATION */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="service-name"
                  className="text-xs font-medium text-foreground"
                >
                  Service Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="service-name"
                  placeholder="e.g. web-frontend"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (canGoNextFromStep3) handleNext()
                    }
                  }}
                  autoFocus
                />
                <p className="text-2xs text-muted-foreground">
                  Unique identifier for this service within the project.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="internal-port"
                    className="text-xs font-medium text-foreground"
                  >
                    Internal Port <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="internal-port"
                    type="number"
                    placeholder="3000"
                    value={internalPort}
                    onChange={(e) => setInternalPort(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        if (canGoNextFromStep3) handleNext()
                      }
                    }}
                  />
                  <p className="text-2xs text-muted-foreground">
                    Container port (e.g. 3000, 8080).
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="health-check"
                    className="text-xs font-medium text-foreground"
                  >
                    Health Check Path
                  </label>
                  <Input
                    id="health-check"
                    placeholder="/healthz"
                    value={healthCheckPath}
                    onChange={(e) => setHealthCheckPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        if (canGoNextFromStep3) handleNext()
                      }
                    }}
                  />
                  <p className="text-2xs text-muted-foreground">
                    HTTP endpoint for health checks.
                  </p>
                </div>
              </div>

              {/* SQLite Persistent Volume Section (ADR-008) */}
              <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
                <span className="text-xs font-semibold text-foreground">
                  Persistent Storage Volume (Optional)
                </span>
                <p className="text-2xs text-muted-foreground">
                  Enable persistent storage for in-process SQLite databases or
                  disk files (ADR-008).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="app-volume-name"
                      className="text-2xs font-medium text-muted-foreground"
                    >
                      Volume Name
                    </label>
                    <Input
                      id="app-volume-name"
                      placeholder="e.g. app_sqlite_data"
                      value={appVolumeName}
                      onChange={(e) => setAppVolumeName(e.target.value)}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="app-volume-mount"
                      className="text-2xs font-medium text-muted-foreground"
                    >
                      Container Mount Path
                    </label>
                    <Input
                      id="app-volume-mount"
                      placeholder="e.g. /var/data/sqlite"
                      value={appVolumeMount}
                      onChange={(e) => setAppVolumeMount(e.target.value)}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Deploy Script Hooks Section */}
              <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
                <span className="text-xs font-semibold text-foreground">
                  Deploy Script Hooks (Optional)
                </span>
                <p className="text-2xs text-muted-foreground">
                  Commands executed before build or immediately inside the
                  container after health check passes.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="pre-deploy-command"
                      className="text-2xs font-medium text-muted-foreground"
                    >
                      Pre-deploy Command
                    </label>
                    <Input
                      id="pre-deploy-command"
                      placeholder="e.g. php artisan down"
                      value={preDeployCommand}
                      onChange={(e) => setPreDeployCommand(e.target.value)}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="post-deploy-command"
                      className="text-2xs font-medium text-muted-foreground"
                    >
                      Post-deploy Command
                    </label>
                    <Input
                      id="post-deploy-command"
                      placeholder="e.g. php artisan migrate --force"
                      value={postDeployCommand}
                      onChange={(e) => setPostDeployCommand(e.target.value)}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: TARGET SERVER & PRE-DEPLOYMENT SUMMARY */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground">
                  Target Server Node <span className="text-destructive">*</span>
                </span>
                <p className="text-2xs text-muted-foreground">
                  Select a target node running Tako Agent to host this service container.
                </p>
              </div>

              {isLoadingServers ? (
                <div className="flex items-center justify-center p-6 text-xs text-muted-foreground">
                  <CircleNotchIcon className="mr-2 size-4 animate-spin" />
                  <span>Discovering servers...</span>
                </div>
              ) : servers.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No registered servers available. Please register a server node in Servers settings.
                </div>
              ) : (
                <div className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
                  {servers.map((srv) => {
                    const isSelected = selectedServerId === srv.id
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => setSelectedServerId(srv.id)}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-3 text-left transition-colors",
                          isSelected
                            ? "border-foreground bg-muted/50"
                            : "border-border hover:bg-muted/30"
                        )}
                        aria-pressed={isSelected}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-md border border-border bg-muted/60 text-foreground">
                            <HardDrivesIcon className="size-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground">
                                {srv.name}
                              </span>
                              <span className="font-mono text-3xs text-muted-foreground">
                                {srv.host}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 pt-1 font-mono text-2xs text-muted-foreground">
                              <span>CPU: {srv.cpu_percent}%</span>
                              <span>RAM: {srv.ram_percent}%</span>
                              <span>Disk: {srv.disk_percent}%</span>
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                            <CheckIcon className="size-3" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Pre-deployment Summary Card */}
              {selectedServer && (
                <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/20 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Deployment Summary
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-3xs font-medium text-emerald-600">
                      Ready to deploy
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <span className="text-3xs text-muted-foreground">Service Name</span>
                      <p className="font-semibold text-foreground truncate">{serviceName}</p>
                    </div>
                    <div>
                      <span className="text-3xs text-muted-foreground">Target Server</span>
                      <p className="font-medium text-foreground truncate">
                        {selectedServer.name} ({selectedServer.host})
                      </p>
                    </div>
                    <div>
                      <span className="text-3xs text-muted-foreground">Repository & Branch</span>
                      <p className="font-mono text-2xs text-foreground truncate">
                        {useCustomGit ? customGitUrl : selectedRepo?.full_name || "Custom"} ({selectedBranch})
                      </p>
                    </div>
                    <div>
                      <span className="text-3xs text-muted-foreground">Internal Port</span>
                      <p className="font-mono text-2xs text-foreground truncate">
                        :{internalPort} {healthCheckPath ? `(${healthCheckPath})` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Wizard Footer Navigation */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            {currentStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBack}
                disabled={isSubmitting}
                className="gap-1"
              >
                <ArrowLeftIcon className="size-3.5" />
                <span>Back</span>
              </Button>
            ) : onCancel ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <Button
                type="button"
                size="sm"
                onClick={handleNext}
                disabled={
                  (currentStep === 1 && !canGoNextFromStep1) ||
                  (currentStep === 2 && !canGoNextFromStep2) ||
                  (currentStep === 3 && !canGoNextFromStep3)
                }
                className="gap-1"
              >
                <span>Continue</span>
                <ArrowRightIcon className="size-3.5" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <CircleNotchIcon className="size-3.5 animate-spin" />
                    <span>Deploying...</span>
                  </>
                ) : (
                  <span>
                    {selectedServer
                      ? `Deploy to ${selectedServer.name}`
                      : "Create & Deploy"}
                  </span>
                )}
              </Button>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* DATABASE TEMPLATE CATEGORY */}
      {/* ========================================================================= */}
      {category === "database" && (
        <div className="flex flex-col gap-4">
          {/* Engine Selection Cards */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">
              Select Curated Database Engine{" "}
              <span className="text-destructive">*</span>
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              {/* PostgreSQL Card */}
              <button
                type="button"
                onClick={() => handleEngineChange("postgres")}
                className={cn(
                  "flex min-h-10 cursor-pointer flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors",
                  dbEngine === "postgres"
                    ? "border-foreground bg-muted/40 font-semibold"
                    : "border-border bg-card hover:bg-muted/30"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    PostgreSQL
                  </span>
                  <DatabaseIcon className="size-3.5 text-primary" />
                </div>
                <span className="text-2xs text-muted-foreground">
                  Port 5432
                </span>
                <span className="font-mono text-3xs text-muted-foreground">
                  v16-alpine
                </span>
              </button>

              {/* MySQL Card */}
              <button
                type="button"
                onClick={() => handleEngineChange("mysql")}
                className={cn(
                  "flex min-h-10 cursor-pointer flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors",
                  dbEngine === "mysql"
                    ? "border-foreground bg-muted/40 font-semibold"
                    : "border-border bg-card hover:bg-muted/30"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    MySQL
                  </span>
                  <DatabaseIcon className="size-3.5 text-primary" />
                </div>
                <span className="text-2xs text-muted-foreground">
                  Port 3306
                </span>
                <span className="font-mono text-3xs text-muted-foreground">
                  v8.4 LTS
                </span>
              </button>

              {/* Redis Card */}
              <button
                type="button"
                onClick={() => handleEngineChange("redis")}
                className={cn(
                  "flex min-h-10 cursor-pointer flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors",
                  dbEngine === "redis"
                    ? "border-foreground bg-muted/40 font-semibold"
                    : "border-border bg-card hover:bg-muted/30"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    Redis
                  </span>
                  <DatabaseIcon className="size-3.5 text-primary" />
                </div>
                <span className="text-2xs text-muted-foreground">
                  Port 6379
                </span>
                <span className="font-mono text-3xs text-muted-foreground">
                  v7-alpine
                </span>
              </button>
            </div>
          </div>

          {/* Engine Version and Service Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="db-engine-version"
                className="text-xs font-medium text-foreground"
              >
                Engine Tag
              </label>
              <Input
                id="db-engine-version"
                value={dbVersion}
                onChange={(e) => setDbVersion(e.target.value)}
                placeholder={
                  dbEngine === "postgres"
                    ? "16-alpine"
                    : dbEngine === "mysql"
                      ? "8.4"
                      : "7-alpine"
                }
                className="h-9 font-mono text-xs"
              />
              <p className="text-2xs text-muted-foreground">
                Any valid Docker image tag.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="db-service-name"
                className="text-xs font-medium text-foreground"
              >
                Service Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="db-service-name"
                value={dbServiceName}
                onChange={(e) => setDbServiceName(e.target.value)}
                placeholder="e.g. acme-postgres"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Target Server Node */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="db-target-server"
              className="text-xs font-medium text-foreground"
            >
              Target Server Node <span className="text-destructive">*</span>
            </label>
            <Select
              value={selectedServerId}
              onValueChange={(v) => v && setSelectedServerId(v)}
            >
              <SelectTrigger id="db-target-server" className="w-full">
                <SelectValue placeholder="Select a server" />
              </SelectTrigger>
              <SelectContent>
                {servers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.host || "Local"}) [{s.status}]
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Credentials Card */}
          <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
            <span className="text-xs font-semibold text-foreground">
              Auto-Generated Credentials & Configuration
            </span>

            {dbEngine !== "redis" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="db-database-name"
                    className="text-2xs font-medium text-muted-foreground"
                  >
                    Database Name
                  </label>
                  <Input
                    id="db-database-name"
                    value={dbName}
                    onChange={(e) => setDbName(e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="db-database-user"
                    className="text-2xs font-medium text-muted-foreground"
                  >
                    User
                  </label>
                  <Input
                    id="db-database-user"
                    value={dbUser}
                    onChange={(e) => setDbUser(e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label
                htmlFor="db-database-password"
                className="text-2xs font-medium text-muted-foreground"
              >
                Password
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="db-database-password"
                  type={showDbPassword ? "text" : "password"}
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  className="h-8 flex-1 font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDbPassword(!showDbPassword)}
                  className="h-8 px-2 text-xs"
                  title={showDbPassword ? "Hide password" : "Show password"}
                  aria-label={
                    showDbPassword ? "Hide password" : "Show password"
                  }
                >
                  {showDbPassword ? (
                    <EyeSlashIcon className="size-3.5" />
                  ) : (
                    <EyeIcon className="size-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDbPassword(generateRandomPassword())}
                  className="h-8 px-2 text-xs"
                  title="Generate new password"
                  aria-label="Generate new password"
                >
                  <ArrowsClockwiseIcon className="size-3.5" />
                </Button>
                <CopyButton
                  text={dbPassword}
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  title="Copy password"
                  aria-label="Copy password"
                />
              </div>
            </div>

            {/* Storage Volume & Network Details */}
            <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2 text-2xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Docker Volume:</span>
                <span className="font-mono text-foreground">
                  tako_vol_
                  {dbServiceName.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "db"}
                  _data
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Mount Path:</span>
                <span className="font-mono text-foreground">
                  {dbEngine === "mysql"
                    ? "/var/lib/mysql"
                    : dbEngine === "redis"
                      ? "/data"
                      : "/var/lib/postgresql/data"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Network:</span>
                <span className="font-mono text-foreground">
                  tako_network (Private only)
                </span>
              </div>
            </div>

            {/* Connection URI Preview */}
            <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-medium text-muted-foreground">
                  Internal Connection URI:
                </span>
                <CopyButton
                  text={calculatedURI}
                  label="Copy URI"
                  variant="ghost"
                  size="xs"
                  className="inline-flex h-auto cursor-pointer items-center gap-1 p-0 text-2xs text-primary hover:underline"
                />
              </div>
              <div className="rounded border border-border bg-muted/60 p-2 font-mono text-2xs break-all text-foreground">
                {calculatedURI}
              </div>
            </div>
          </div>

          {/* Database Submit Footer */}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            {onCancel ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            ) : (
              <div />
            )}

            <Button
              type="submit"
              size="sm"
              disabled={!canSubmitDatabase || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                  <span>Provisioning Database...</span>
                </>
              ) : (
                <span>Provision Database</span>
              )}
            </Button>
          </div>
        </div>
      )}

      {category === "compose" && (
        <div className="flex flex-col gap-4">
          {/* Target Server Select */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="compose-server-select"
              className="text-xs font-semibold text-foreground"
            >
              Target Server <span className="text-destructive">*</span>
            </label>
            {isLoadingServers ? (
              <div className="h-10 animate-pulse rounded-md border border-border bg-muted" />
            ) : (
              <Select
                value={selectedServerId}
                onValueChange={(val) => {
                  if (val) setSelectedServerId(val)
                }}
              >
                <SelectTrigger id="compose-server-select" className="w-full">
                  <SelectValue placeholder="Select target server node" />
                </SelectTrigger>
                <SelectContent>
                  {servers.map((srv) => (
                    <SelectItem key={srv.id} value={srv.id}>
                      {srv.name} ({srv.host}) - {srv.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Service Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="compose-service-name"
              className="text-xs font-semibold text-foreground"
            >
              Stack Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="compose-service-name"
              value={composeServiceName}
              onChange={(e) => setComposeServiceName(e.target.value)}
              placeholder="e.g. acme-microservices"
            />
            <p className="text-2xs text-muted-foreground">
              A unique identifier for this multi-container stack.
            </p>
          </div>

          {/* Source Mode: Inline YAML vs Git Repository */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-foreground">
              Compose Definition Source
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setComposeSourceMode("inline")}
                className={cn(
                  "flex min-h-10 cursor-pointer flex-col items-start rounded-md border p-3 text-left transition-colors",
                  composeSourceMode === "inline"
                    ? "border-foreground bg-muted/40 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-xs font-semibold">
                  Inline Compose YAML
                </span>
                <span className="text-2xs text-muted-foreground">
                  Paste or edit docker-compose.yml directly
                </span>
              </button>
              <button
                type="button"
                onClick={() => setComposeSourceMode("git")}
                className={cn(
                  "flex min-h-10 cursor-pointer flex-col items-start rounded-md border p-3 text-left transition-colors",
                  composeSourceMode === "git"
                    ? "border-foreground bg-muted/40 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-xs font-semibold">Git Repository</span>
                <span className="text-2xs text-muted-foreground">
                  Deploy from repo with docker-compose.yml
                </span>
              </button>
            </div>
          </div>

          {/* Inline YAML Editor */}
          {composeSourceMode === "inline" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="compose-yaml-editor"
                  className="text-xs font-semibold text-foreground"
                >
                  Compose Specification (YAML)
                </label>
                <button
                  type="button"
                  onClick={() => handleValidateCompose(composeYamlContent)}
                  disabled={isValidatingCompose || !composeYamlContent.trim()}
                  className="inline-flex h-8 cursor-pointer items-center gap-1 text-2xs text-primary hover:underline"
                >
                  {isValidatingCompose ? (
                    <>
                      <CircleNotchIcon className="size-3 animate-spin" />
                      <span>Validating...</span>
                    </>
                  ) : (
                    <span>Validate Schema</span>
                  )}
                </button>
              </div>

              <textarea
                id="compose-yaml-editor"
                rows={10}
                value={composeYamlContent}
                onChange={(e) => {
                  setComposeYamlContent(e.target.value)
                  if (composeValidation) setComposeValidation(null)
                }}
                placeholder="version: '3.8'&#10;services:&#10;  web:&#10;    image: nginx:alpine"
                className="w-full rounded-md border border-border bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-100 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              />

              {/* Validation Feedback */}
              {composeValidation && (
                <div
                  className={cn(
                    "flex flex-col gap-1 rounded-md border p-2.5 text-xs",
                    composeValidation.valid
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  )}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    {composeValidation.valid ? (
                      <>
                        <CheckIcon className="size-4 text-emerald-500" />
                        <span>Valid Compose configuration</span>
                      </>
                    ) : (
                      <>
                        <WarningCircleIcon className="size-4 text-destructive" />
                        <span>Compose configuration has errors</span>
                      </>
                    )}
                  </div>
                  {composeValidation.valid && composeValidation.services && (
                    <div className="mt-0.5 text-2xs opacity-90">
                      Detected services:{" "}
                      {composeValidation.services.map((s) => s.name).join(", ")}
                    </div>
                  )}
                  {composeValidation.errors &&
                    composeValidation.errors.length > 0 && (
                      <ul className="flex list-disc flex-col gap-0.5 pl-4 text-2xs">
                        {composeValidation.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    )}
                </div>
              )}
            </div>
          ) : (
            /* Git Repository Mode */
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Repository URL or Selection
                </label>
                <Input
                  value={customGitUrl}
                  onChange={(e) => setCustomGitUrl(e.target.value)}
                  placeholder="e.g. https://github.com/octopy/stack-demo"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Branch
                  </label>
                  <Input
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    placeholder="main"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Compose File Path
                  </label>
                  <Input
                    value={composeFilePath}
                    onChange={(e) => setComposeFilePath(e.target.value)}
                    placeholder="docker-compose.yml"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Compose Submit Footer */}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            {onCancel ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            ) : (
              <div />
            )}

            <Button
              type="submit"
              size="sm"
              disabled={!canSubmitCompose || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                  <span>Deploying Stack...</span>
                </>
              ) : (
                <span>Deploy Compose Stack</span>
              )}
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}

export interface CreateServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  initialTab?: "app" | "database" | "compose"
  onServiceCreated?: (serviceId: string) => void
}

export function CreateServiceDialog({
  open,
  onOpenChange,
  projectId,
  initialTab = "app",
  onServiceCreated,
}: CreateServiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl">
        <CreateServiceWizard
          projectId={projectId}
          initialTab={initialTab}
          onSuccess={(serviceId) => {
            onOpenChange(false)
            if (onServiceCreated) onServiceCreated(serviceId)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
