"use client"

import * as React from "react"
import {
  Check,
  Copy,
  Maximize2,
  Minimize2,
  RefreshCw,
  Terminal,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  SearchableSelect,
  type SelectOption,
} from "@/components/ui/searchable-select"
import { getServiceContainers } from "@/lib/container"
import { ProjectService } from "@/types/platform"
import { copyToClipboard } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

interface ServiceTerminalTabProps {
  service: ProjectService
  isMinimized?: boolean
  onToggleMinimize?: () => void
}

interface CommandOutput {
  id: string
  command: string
  output: string
  timestamp: string
  cwd?: string
}

interface FsEntry {
  name: string
  isDir: boolean
}

const VIRTUAL_FS: Record<string, FsEntry[]> = {
  "/": [
    { name: "app", isDir: true },
    { name: "bin", isDir: true },
    { name: "dev", isDir: true },
    { name: "etc", isDir: true },
    { name: "home", isDir: true },
    { name: "lib", isDir: true },
    { name: "proc", isDir: true },
    { name: "root", isDir: true },
    { name: "sys", isDir: true },
    { name: "tmp", isDir: true },
    { name: "usr", isDir: true },
    { name: "var", isDir: true },
  ],
  "/app": [
    { name: ".env", isDir: false },
    { name: ".gitignore", isDir: false },
    { name: "Dockerfile", isDir: false },
    { name: "README.md", isDir: false },
    { name: "config", isDir: true },
    { name: "docker-compose.yml", isDir: false },
    { name: "internal", isDir: true },
    { name: "logs", isDir: true },
    { name: "package.json", isDir: false },
    { name: "src", isDir: true },
    { name: "tako-service", isDir: false },
  ],
  "/app/config": [
    { name: "app.json", isDir: false },
    { name: "config.yaml", isDir: false },
    { name: "env.production", isDir: false },
    { name: "env.staging", isDir: false },
  ],
  "/app/internal": [
    { name: "api", isDir: true },
    { name: "model", isDir: true },
    { name: "server", isDir: true },
    { name: "store", isDir: true },
    { name: "telemetry", isDir: true },
  ],
  "/app/internal/api": [
    { name: "handler.go", isDir: false },
    { name: "middleware.go", isDir: false },
    { name: "routes.go", isDir: false },
  ],
  "/app/internal/model": [
    { name: "service.go", isDir: false },
    { name: "user.go", isDir: false },
  ],
  "/app/internal/server": [
    { name: "config.go", isDir: false },
    { name: "server.go", isDir: false },
  ],
  "/app/internal/store": [
    { name: "db.go", isDir: false },
    { name: "queries.sql", isDir: false },
    { name: "schema.sql", isDir: false },
  ],
  "/app/internal/telemetry": [
    { name: "metrics.go", isDir: false },
    { name: "tracer.go", isDir: false },
  ],
  "/app/logs": [
    { name: "access.log", isDir: false },
    { name: "app.log", isDir: false },
    { name: "error.log", isDir: false },
  ],
  "/app/src": [
    { name: "index.ts", isDir: false },
    { name: "routes", isDir: true },
    { name: "server.ts", isDir: false },
    { name: "types.ts", isDir: false },
    { name: "utils", isDir: true },
  ],
  "/app/src/routes": [
    { name: "api.ts", isDir: false },
    { name: "health.ts", isDir: false },
  ],
  "/app/src/utils": [
    { name: "db.ts", isDir: false },
    { name: "logger.ts", isDir: false },
  ],
  "/etc": [
    { name: "environment", isDir: false },
    { name: "hostname", isDir: false },
    { name: "hosts", isDir: false },
    { name: "os-release", isDir: false },
    { name: "resolv.conf", isDir: false },
    { name: "ssl", isDir: true },
    { name: "tako", isDir: true },
  ],
  "/etc/tako": [
    { name: "agent.yaml", isDir: false },
    { name: "certs", isDir: true },
    { name: "traefik.yml", isDir: false },
  ],
  "/etc/ssl": [{ name: "certs", isDir: true }],
  "/var": [
    { name: "cache", isDir: true },
    { name: "log", isDir: true },
    { name: "run", isDir: true },
    { name: "tmp", isDir: true },
  ],
  "/var/log": [
    { name: "docker.log", isDir: false },
    { name: "messages", isDir: false },
    { name: "nginx", isDir: true },
    { name: "tako-agent.log", isDir: false },
  ],
  "/bin": [
    { name: "bash", isDir: false },
    { name: "cat", isDir: false },
    { name: "chmod", isDir: false },
    { name: "chown", isDir: false },
    { name: "cp", isDir: false },
    { name: "curl", isDir: false },
    { name: "df", isDir: false },
    { name: "env", isDir: false },
    { name: "free", isDir: false },
    { name: "grep", isDir: false },
    { name: "kill", isDir: false },
    { name: "ls", isDir: false },
    { name: "mkdir", isDir: false },
    { name: "mv", isDir: false },
    { name: "ps", isDir: false },
    { name: "rm", isDir: false },
    { name: "sh", isDir: false },
    { name: "top", isDir: false },
    { name: "uptime", isDir: false },
    { name: "whoami", isDir: false },
    { name: "zsh", isDir: false },
  ],
  "/root": [
    { name: ".bashrc", isDir: false },
    { name: ".profile", isDir: false },
  ],
  "/tmp": [{ name: "tako-session.sock", isDir: false }],
}

function resolvePath(cwd: string, targetPath: string): string {
  if (!targetPath) return cwd
  const isAbs = targetPath.startsWith("/")
  const fullPath = isAbs ? targetPath : `${cwd}/${targetPath}`
  const parts = fullPath.split("/").filter(Boolean)
  const resolved: string[] = []

  for (const part of parts) {
    if (part === ".") continue
    if (part === "..") {
      if (resolved.length > 0) {
        resolved.pop()
      }
    } else {
      resolved.push(part)
    }
  }

  return "/" + resolved.join("/")
}

function getCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return ""
  let prefix = strings[0]
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1)
      if (!prefix) return ""
    }
  }
  return prefix
}

const INITIAL_WELCOME: string[] = [
  "⚡️ Tako Terminal v2.4.0 (x86_64-alpine-linux)",
  "Connected via gRPC terminal stream to target node daemon (pts/0)",
  "Type 'help' to view available diagnostics commands.",
]

function getPromptMeta(service: ProjectService, cwd: string = "/app") {
  return {
    user: "root",
    host: service.slug,
    cwd: cwd,
    branch: service.lastDeployment.branch || service.gitBranch || "main",
    commit: (service.lastDeployment.commitHash || "a087061").slice(0, 7),
  }
}

function TerminalPrompt({
  service,
  cwd = "/app",
  children,
}: {
  service: ProjectService
  cwd?: string
  children: React.ReactNode
}) {
  const meta = getPromptMeta(service, cwd)

  return (
    <div className="space-y-0.5 font-mono text-[12px]">
      <div className="flex flex-wrap items-center leading-none text-muted-foreground/60">
        <span>┌─[</span>
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
          {meta.user}
        </span>
        <span>@</span>
        <span className="font-semibold text-sky-700 dark:text-cyan-400">
          {meta.host}
        </span>
        <span>][</span>
        <span className="text-amber-700 dark:text-amber-300">{meta.cwd}</span>
        <span>] [</span>
        <span className="text-violet-700 dark:text-violet-300">
          {meta.branch}
        </span>
        <span className="ml-1 text-muted-foreground/80">{meta.commit}</span>
        <span>]</span>
      </div>

      <div className="flex items-center gap-2 text-foreground dark:text-zinc-200">
        <span className="text-muted-foreground/60">└─</span>
        <span className="text-primary">➣</span>
        {children}
      </div>
    </div>
  )
}

export function ServiceTerminalTab({
  service,
  isMinimized: _isMinimized = false,
  onToggleMinimize: _onToggleMinimize,
}: ServiceTerminalTabProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [shell, setShell] = React.useState<
    "/bin/sh" | "/bin/bash" | "/bin/zsh"
  >("/bin/sh")
  const containers = React.useMemo(
    () => getServiceContainers(service),
    [service]
  )
  const [preferredContainer, setPreferredContainer] = React.useState<string>(
    () => {
      const main = containers.find((container) => container.isMain)
      return main?.name ?? containers[0]?.name ?? `tako_${service.slug}`
    }
  )
  const selectedContainer = containers.some(
    (container) => container.name === preferredContainer
  )
    ? preferredContainer
    : (containers.find((container) => container.isMain)?.name ??
      containers[0]?.name ??
      `tako_${service.slug}`)

  const containerOptions: SelectOption[] = React.useMemo(
    () =>
      containers.map((container) => ({
        value: container.name,
        label: `${container.name}${container.isMain ? " (main)" : ""}`,
        description: `${container.ports.length} exposed port${container.ports.length === 1 ? "" : "s"}`,
      })),
    [containers]
  )

  const shellOptions: SelectOption[] = React.useMemo(
    () => [
      { value: "/bin/sh", label: "/bin/sh" },
      { value: "/bin/bash", label: "/bin/bash" },
      { value: "/bin/zsh", label: "/bin/zsh" },
    ],
    []
  )

  const [currentCwd, setCurrentCwd] = React.useState("/app")
  const [inputVal, setInputVal] = React.useState("")
  const [commandHistory, setCommandHistory] = React.useState<string[]>([])
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1)
  const [historyList, setHistoryList] = React.useState<CommandOutput[]>([])
  const [copiedBuffer, setCopiedBuffer] = React.useState(false)
  const [isReconnecting, setIsReconnecting] = React.useState(false)
  const [wsConnected, setWsConnected] = React.useState(false)
  const wsRef = React.useRef<WebSocket | null>(null)

  // Establish WebSocket connection to backend terminal when available
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const token = localStorage.getItem("tako_token") || ""
    if (!token) return

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
        ? `${window.location.hostname}:8080`
        : window.location.host
    const wsUrl = `${protocol}//${host}/api/v1/services/${service.id}/terminal?token=${encodeURIComponent(token)}&container=${encodeURIComponent(selectedContainer)}`

    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(wsUrl)
      ws.onopen = () => {
        setWsConnected(true)
      }
      ws.onmessage = (event) => {
        const text = typeof event.data === "string" ? event.data : ""
        if (text && !text.includes("Error: service not found")) {
          setHistoryList((prev) => [
            ...prev,
            {
              id: `ws-${Date.now()}-${Math.random()}`,
              command: "",
              // eslint-disable-next-line no-control-regex
              output: text.replace(/\x1b\[[0-9;]*m/g, "").trim(),
              timestamp: new Date().toLocaleTimeString(),
              cwd: currentCwd,
            },
          ])
        }
      }
      ws.onerror = () => {
        setWsConnected(false)
      }
      ws.onclose = () => {
        setWsConnected(false)
      }
      wsRef.current = ws
    } catch {
      // WebSocket connection attempt failed
    }

    return () => {
      ws?.close()
      wsRef.current = null
    }
  }, [service.id, selectedContainer, currentCwd])

  const terminalRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Keep the viewport pinned to the latest output after layout settles.
  React.useEffect(() => {
    const node = terminalRef.current
    if (!node) return

    const frame = requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight
    })

    return () => cancelAnimationFrame(frame)
  }, [historyList, inputVal, isFullscreen])

  // ESC key to exit fullscreen
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen])

  const handleTabAutocomplete = () => {
    const input = inputVal
    const cursorPos = inputRef.current?.selectionStart ?? input.length
    const textBeforeCursor = input.slice(0, cursorPos)
    const textAfterCursor = input.slice(cursorPos)

    // Match the argument at the cursor
    const match = textBeforeCursor.match(/(\S+)$/)
    const rawToken = match ? match[1] : ""
    const tokenStartIndex =
      match && match.index !== undefined ? match.index : cursorPos

    // Command context to know if cd is active
    const commandWords = textBeforeCursor.trim().split(/\s+/)
    const isCd = commandWords[0]?.toLowerCase() === "cd"

    // Slashes in token
    const lastSlashIndex = rawToken.lastIndexOf("/")
    let dirPart = ""
    let basePart = rawToken

    if (lastSlashIndex !== -1) {
      dirPart = rawToken.slice(0, lastSlashIndex + 1)
      basePart = rawToken.slice(lastSlashIndex + 1)
    }

    // Resolve directory
    const resolvedDir = resolvePath(currentCwd, dirPart)
    const entries = VIRTUAL_FS[resolvedDir] || []

    // Filter candidate list: if "cd", only folders; otherwise all entries
    const candidates = isCd ? entries.filter((e) => e.isDir) : entries

    // Filter by basePart prefix (case-sensitive first, fallback to case-insensitive)
    let matches = candidates.filter((e) => e.name.startsWith(basePart))
    if (matches.length === 0 && basePart) {
      matches = candidates.filter((e) =>
        e.name.toLowerCase().startsWith(basePart.toLowerCase())
      )
    }

    if (matches.length === 0) {
      return
    }

    if (matches.length === 1) {
      const single = matches[0]
      const suffix = single.isDir ? "/" : " "
      const completedToken = dirPart + single.name + suffix
      const newInputVal =
        textBeforeCursor.slice(0, tokenStartIndex) +
        completedToken +
        textAfterCursor

      setInputVal(newInputVal)
      const newCursor = tokenStartIndex + completedToken.length
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.setSelectionRange(newCursor, newCursor)
        }
      })
      return
    }

    // Multiple matches
    const matchNames = matches.map((m) => m.name)
    const commonPrefix = getCommonPrefix(matchNames)

    if (commonPrefix.length > basePart.length) {
      // Partial completion up to common prefix
      const partialToken = dirPart + commonPrefix
      const newInputVal =
        textBeforeCursor.slice(0, tokenStartIndex) +
        partialToken +
        textAfterCursor

      setInputVal(newInputVal)
      const newCursor = tokenStartIndex + partialToken.length
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.setSelectionRange(newCursor, newCursor)
        }
      })
    } else {
      // Show available candidates in the output buffer without altering input line
      const candidateDisplay = matches
        .map((m) => (m.isDir ? `${m.name}/` : m.name))
        .sort((a, b) => a.localeCompare(b))
        .join("  ")

      setHistoryList((prev) => [
        ...prev,
        {
          id: `tab-${Date.now()}-${Math.random()}`,
          command: inputVal,
          output: candidateDisplay,
          timestamp: new Date().toLocaleTimeString(),
          cwd: currentCwd,
        },
      ])
    }
  }

  const executeCommand = (cmd: string) => {
    const trimmed = cmd.trim()
    if (!trimmed) return

    setCommandHistory((prev) => [trimmed, ...prev])
    setHistoryIndex(-1)

    const now = new Date().toLocaleTimeString()
    let result = ""

    const lower = trimmed.toLowerCase()

    if (lower === "clear") {
      setHistoryList([])
      setInputVal("")
      return
    }

    if (
      wsRef.current &&
      wsConnected &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send(trimmed + "\n")
      setInputVal("")
      return
    }

    if (lower === "help") {
      result = [
        "Available Container Diagnostics Commands:",
        "  help         Show this command reference list",
        "  ls [path]    List directory contents",
        "  cd [path]    Change current working directory",
        "  pwd          Print current working directory",
        "  cat <file>   Display contents of a file (e.g. Dockerfile, app.json)",
        "  ps [aux]     List running container processes",
        "  top          Display live process and memory snapshot",
        "  env          Print container environment variables",
        "  curl <url>   HTTP probe against local endpoint (e.g. localhost:8443/healthz)",
        "  df -h        Display filesystem disk space usage",
        "  free -m      Display memory utilization",
        "  uptime       Show container uptime and system load",
        "  whoami       Print effective user ID (root)",
        "  uname -a     Print system architecture and kernel",
        "  clear        Clear the terminal display",
      ].join("\n")
    } else if (lower === "cd" || lower === "cd ~") {
      setCurrentCwd("/app")
      result = ""
    } else if (lower.startsWith("cd ")) {
      const target = trimmed.slice(3).trim()
      const resolved = resolvePath(currentCwd, target)
      if (VIRTUAL_FS[resolved]) {
        setCurrentCwd(resolved)
        result = ""
      } else {
        result = `cd: no such file or directory: ${target}`
      }
    } else if (lower === "pwd") {
      result = currentCwd
    } else if (lower.startsWith("ls") || lower === "ll") {
      const parts = trimmed
        .split(/\s+/)
        .filter((p) => !p.startsWith("-") && p !== "ls" && p !== "ll")
      const rawTarget = parts.length > 0 ? parts[0] : ""
      const resolved = resolvePath(currentCwd, rawTarget)
      const dirEntries = VIRTUAL_FS[resolved]

      if (dirEntries) {
        const lines = [
          `total ${dirEntries.length * 4 + 8}`,
          "drwxr-xr-x 1 root root  4096 Oct 18 10:14 .",
          "drwxr-xr-x 1 root root  4096 Oct 18 10:12 ..",
          ...dirEntries.map((e) => {
            const isDir = e.isDir
            const perm = isDir
              ? "drwxr-xr-x 2 root root  4096"
              : "-rw-r--r-- 1 root root  1024"
            return `${perm} Oct 18 10:14 ${e.name}`
          }),
        ]
        result = lines.join("\n")
      } else {
        // Check if it's an individual file
        const lastSlash = resolved.lastIndexOf("/")
        const parentDir = resolved.slice(0, lastSlash) || "/"
        const fileName = resolved.slice(lastSlash + 1)
        const fileEntry = VIRTUAL_FS[parentDir]?.find(
          (e) => e.name === fileName
        )

        if (fileEntry) {
          result = `-rw-r--r-- 1 root root  1024 Oct 18 10:14 ${rawTarget}`
        } else {
          result = `ls: cannot access '${rawTarget}': No such file or directory`
        }
      }
    } else if (lower.startsWith("ps")) {
      result = [
        "PID   USER     TIME  COMMAND",
        "    1 root      0:18 /app/tako-service --port 8443 --grpc :50051",
        "   12 root      0:04 tako-telemetry-agent --interval 5s",
        "   28 root      0:00 " + shell + " -i (pts/0)",
      ].join("\n")
    } else if (lower === "top") {
      result = [
        "Mem: 148M used, 876M free, 1024M limit",
        "CPU: 12.4% user, 1.2% sys, 86.4% idle",
        "Tasks: 3 total, 1 running, 2 sleeping, 0 stopped",
        "",
        "  PID  USER   PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND",
        "    1  root   20   0  148.2m  42.1m  12.4m S  11.2   4.1   0:18.42 tako-service",
        "   12  root   20   0   48.1m  18.4m   6.2m S   1.2   1.8   0:04.11 tako-telemetry",
      ].join("\n")
    } else if (lower === "env") {
      result = (service.envVars || [])
        .map((e) =>
          e.isSecret ? `${e.key}=[REDACTED_SECRET]` : `${e.key}=${e.value}`
        )
        .join("\n")
      if (!result) {
        result =
          "PORT=8443\nNODE_ENV=production\nHOSTNAME=tako-" + service.slug
      }
    } else if (lower.startsWith("cat ")) {
      const file = trimmed.slice(4).trim()
      if (file.includes("os-release")) {
        result = [
          'NAME="Alpine Linux"',
          "ID=alpine",
          "VERSION_ID=3.20.2",
          'PRETTY_NAME="Alpine Linux v3.20"',
          'HOME_URL="https://alpinelinux.org/"',
        ].join("\n")
      } else if (file.includes("Dockerfile") || file.includes("dockerfile")) {
        result =
          service.dockerfileContent ||
          'FROM alpine:3.20\nWORKDIR /app\nCOPY . .\nCMD ["./tako-service"]'
      } else if (file.includes(".env")) {
        result = (service.envVars || [])
          .map((e) => `${e.key}=${e.value}`)
          .join("\n")
      } else if (file.includes("package.json")) {
        result = JSON.stringify(
          {
            name: service.name,
            version: "1.0.0",
            private: true,
            scripts: {
              start: "node dist/index.js",
              build: "tsc",
            },
          },
          null,
          2
        )
      } else if (
        file.includes("config.yaml") ||
        file.includes("agent.yaml") ||
        file.includes("traefik.yml")
      ) {
        result = [
          "# Auto-generated configuration for tako runtime",
          `service: ${service.name}`,
          `slug: ${service.slug}`,
          "port: 8443",
          "health_check: /healthz",
          "metrics:",
          "  enabled: true",
          "  interval: 5s",
        ].join("\n")
      } else if (file.includes("app.json")) {
        result = JSON.stringify(
          {
            name: service.name,
            slug: service.slug,
            version: "1.0.0",
            status: service.status,
            replicas: 1,
          },
          null,
          2
        )
      } else if (file.includes("README.md")) {
        result = `# ${service.name}\n\nManaged cloud container on Tako platform.\nStatus: ${service.status}\nImage: ${service.image || "alpine:3.20"}`
      } else if (file.includes(".log")) {
        result = [
          `[${new Date().toISOString()}] INFO Starting worker process...`,
          `[${new Date().toISOString()}] INFO Listening on 0.0.0.0:8443`,
          `[${new Date().toISOString()}] DEBUG Handshake OK with cluster edge node`,
        ].join("\n")
      } else if (file.includes(".go")) {
        result =
          'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Tako service running...")\n}'
      } else if (file.includes(".ts")) {
        result =
          "import http from 'node:http';\n\nconsole.log('Tako service initialized');"
      } else if (file.includes("hosts")) {
        result =
          "127.0.0.1\tlocalhost\n::1\tlocalhost\n10.0.4.12\t" + service.slug
      } else if (file.includes("resolv.conf")) {
        result = "nameserver 127.0.0.11\noptions ndots:0"
      } else {
        result = `cat: ${file}: No such file or directory`
      }
    } else if (lower.startsWith("curl")) {
      result = [
        "HTTP/1.1 200 OK",
        "Content-Type: application/json; charset=utf-8",
        "Date: " + new Date().toUTCString(),
        "Content-Length: 54",
        "",
        `{"status":"healthy","service":"${service.name}","uptime":"14d 06h"}`,
      ].join("\n")
    } else if (lower === "df -h") {
      result = [
        "Filesystem                Size      Used Available Use% Mounted on",
        "overlay                  32.0G      4.2G     26.2G  14% /",
        "tmpfs                    64.0M         0     64.0M   0% /dev",
        "/dev/nvme0n1p1           98.4G     24.1G     69.3G  26% /etc/resolv.conf",
      ].join("\n")
    } else if (lower === "free -m" || lower === "free") {
      result = [
        "              total        used        free      shared  buff/cache   available",
        "Mem:           1024         148         756          12         120         876",
        "Swap:           512           0         512",
      ].join("\n")
    } else if (lower === "uptime") {
      result =
        " 10:14:22 up 14 days,  6:18,  1 user,  load average: 0.14, 0.08, 0.05"
    } else if (lower === "whoami") {
      result = "root"
    } else if (lower === "id") {
      result = "uid=0(root) gid=0(root) groups=0(root)"
    } else if (lower === "hostname") {
      result = `tako-app-${service.slug}`
    } else if (lower === "date") {
      result = new Date().toUTCString()
    } else if (lower.startsWith("echo ")) {
      result = trimmed.slice(5).trim()
    } else if (lower === "printenv" || lower === "env") {
      result =
        (service.envVars || [])
          .map((e) => `${e.key}=${e.value}`)
          .join("\n") || "PORT=8080\nNODE_ENV=production"
    } else if (lower.startsWith("which ")) {
      const bin = trimmed.split(" ")[1]
      result = bin ? `/bin/${bin}` : "which: missing argument"
    } else if (lower.startsWith("ping ")) {
      const host = trimmed.split(" ")[1] || "127.0.0.1"
      result = `PING ${host} (${host}): 56 data bytes\n64 bytes from ${host}: seq=0 ttl=64 time=0.042 ms\n64 bytes from ${host}: seq=1 ttl=64 time=0.038 ms`
    } else if (lower === "uname -a") {
      result =
        "Linux tako-edge-node 6.6.137-edge-tako #1 SMP PREEMPT_DYNAMIC x86_64 Linux"
    } else if (lower === "exit") {
      result =
        "Session closed. Click 'Reconnect' to establish a new container terminal session."
    } else {
      result = `${shell.replace("/bin/", "")}: ${trimmed.split(" ")[0]}: command not found. Type 'help' for available commands.`
    }

    setHistoryList((prev) => [
      ...prev,
      {
        id: `cmd-${Date.now()}`,
        command: trimmed,
        output: result,
        timestamp: now,
        cwd: currentCwd,
      },
    ])
    setInputVal("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      handleTabAutocomplete()
      return
    }
    if (e.key === "Enter") {
      executeCommand(inputVal)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (commandHistory.length === 0) return
      const nextIndex = Math.min(commandHistory.length - 1, historyIndex + 1)
      setHistoryIndex(nextIndex)
      setInputVal(commandHistory[nextIndex] || "")
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex <= 0) {
        setHistoryIndex(-1)
        setInputVal("")
      } else {
        const nextIndex = historyIndex - 1
        setHistoryIndex(nextIndex)
        setInputVal(commandHistory[nextIndex] || "")
      }
    }
  }

  const handleCopyBuffer = async () => {
    const meta = getPromptMeta(service, currentCwd)
    const promptHeader = `┌─[${meta.user}@${meta.host}][${meta.cwd}] [${meta.branch} ${meta.commit}]`
    const bufferText = historyList
      .map((h) => `${promptHeader}\n└─➣ ${h.command}\n${h.output}`)
      .join("\n\n")

    if (await copyToClipboard(bufferText)) {
      setCopiedBuffer(true)
      setTimeout(() => setCopiedBuffer(false), 2000)
    }
  }

  const handleReconnect = async () => {
    setIsReconnecting(true)
    await new Promise((res) => setTimeout(res, 800))
    setIsReconnecting(false)
    setHistoryList([])
    setCurrentCwd("/app")
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card shadow-xs transition-all",
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none border-none bg-background p-4"
          : "h-[540px]"
      )}
    >
      {/* Terminal Header & Toolbar */}
      <div className="flex flex-col gap-2 border-b border-border/80 bg-muted/40 px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-primary" />
          <span className="font-mono text-xs font-bold tracking-tight text-foreground">
            SERVICE TERMINAL
          </span>
          <span className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            {selectedContainer}
          </span>
          <span
            className={cn(
              "flex size-1.5 rounded-full",
              isReconnecting
                ? "animate-pulse bg-amber-500"
                : wsConnected
                  ? "animate-pulse bg-emerald-500"
                  : "bg-primary/80"
            )}
          />
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            {isReconnecting
              ? "reconnecting"
              : wsConnected
                ? "WebSocket PTY Live"
                : "Diagnostic Terminal"}
          </span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {/* Container Selector */}
          <div className="w-40 sm:w-56">
            <SearchableSelect
              size="sm"
              value={selectedContainer}
              onChange={(val) => setPreferredContainer(val)}
              options={containerOptions}
              placeholder="Select container..."
            />
          </div>

          {/* Shell Selector */}
          <div className="w-28">
            <SearchableSelect
              size="sm"
              value={shell}
              onChange={(val) =>
                setShell(val as "/bin/sh" | "/bin/bash" | "/bin/zsh")
              }
              options={shellOptions}
              placeholder="Select shell..."
            />
          </div>

          {/* Clear Buffer */}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setHistoryList([])}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Clear output buffer"
            aria-label="Clear output buffer"
          >
            <Trash2 className="size-3" />
          </Button>

          {/* Copy Buffer */}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleCopyBuffer}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Copy terminal buffer"
            aria-label="Copy terminal buffer"
          >
            {copiedBuffer ? (
              <Check className="size-3 text-emerald-500" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>

          {/* Reconnect */}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={isReconnecting}
            onClick={handleReconnect}
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Restart terminal stream"
            aria-label="Restart terminal stream"
          >
            <RefreshCw
              className={cn("size-3", isReconnecting && "animate-spin")}
            />
          </Button>

          {/* Maximize / Minimize toggle */}
          <Button
            type="button"
            variant={isFullscreen ? "default" : "outline"}
            size="icon-xs"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="size-7"
            title={
              isFullscreen
                ? "Minimize terminal (Esc)"
                : "Maximize terminal to fullscreen"
            }
            aria-label={
              isFullscreen
                ? "Minimize terminal (Esc)"
                : "Maximize terminal to fullscreen"
            }
          >
            {isFullscreen ? (
              <Minimize2 className="size-3" />
            ) : (
              <Maximize2 className="size-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={terminalRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto bg-muted/10 p-4 font-mono text-[12px] leading-relaxed text-foreground select-text dark:bg-background dark:text-foreground/90",
          isFullscreen ? "h-[calc(100vh-90px)]" : "h-[450px]"
        )}
      >
        {/* Welcome Banner */}
        <div className="mb-3 space-y-1 text-muted-foreground select-none dark:text-zinc-500">
          {INITIAL_WELCOME.map((w, idx) => (
            <div key={idx}>{w}</div>
          ))}
        </div>

        {/* Command History */}
        <div className="space-y-3">
          {historyList.map((item) => (
            <div key={item.id} className="space-y-1">
              <TerminalPrompt service={service} cwd={item.cwd || "/app"}>
                <span className="min-w-0 flex-1 font-medium break-all text-foreground dark:text-zinc-100">
                  {item.command}
                </span>
              </TerminalPrompt>
              {item.output && (
                <div className="pl-2 font-mono leading-normal whitespace-pre-wrap text-foreground/90 dark:text-zinc-300">
                  {item.output}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Active Command Input Line */}
        <div className="mt-3">
          <TerminalPrompt service={service} cwd={currentCwd}>
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-foreground caret-emerald-500 outline-hidden [caret-shape:underscore] placeholder:text-muted-foreground dark:text-zinc-100 dark:caret-emerald-400 dark:placeholder:text-zinc-600"
              placeholder="Type command here (e.g. ls, ps, env, top)..."
            />
          </TerminalPrompt>
        </div>
      </div>

      {/* Terminal Status Footer */}
      <div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-muted/20 px-4 font-mono text-[12px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Connected: {selectedContainer}</span>
          </span>
          <span>•</span>
          <span>Shell: {shell}</span>
        </div>

        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span>Buffer: {historyList.length} commands</span>
        </div>
      </div>
    </div>
  )
}
