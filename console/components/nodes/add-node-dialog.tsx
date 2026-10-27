"use client"

import * as React from "react"
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Server,
  Terminal,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CodeHighlighter } from "@/components/ui/code-highlighter"
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
import { DEFAULT_PORTS } from "@/lib/api"
import { usePlatformData } from "@/context/platform-data-context"

export function AddNodeDialog({
  children,
  open,
  onOpenChange,
}: {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { generateEnrollToken, settings, nodes } = usePlatformData()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen

  const [token, setToken] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [initialCount, setInitialCount] = React.useState(nodes.length)

  const grpcHost =
    settings.masterGrpcHost ||
    (typeof window !== "undefined" ? window.location.hostname : "127.0.0.1")
  const grpcPort = settings.masterGrpcPort || DEFAULT_PORTS.GRPC

  const requestToken = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const generated = await generateEnrollToken()
      setToken(generated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue token")
    } finally {
      setIsLoading(false)
    }
  }, [generateEnrollToken])

  React.useEffect(() => {
    if (isOpen && !token && !isLoading) {
      const timer = setTimeout(() => {
        setInitialCount(nodes.length)
        void requestToken()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isOpen, token, isLoading, requestToken, nodes.length])

  const joinCommand = token
    ? `curl -fsSL https://gettako.dev/install.sh | bash -s -- --agent \\
  --token '${token}' \\
  --master '${grpcHost}:${grpcPort}'`
    : "Issuing enrollment token..."

  const newNodeConnected = nodes.length > initialCount

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Server className="size-5 text-primary" />
            <DialogTitle>Connect Edge Node</DialogTitle>
          </div>
          <DialogDescription>
            The token below authorizes one agent to enroll with this control
            plane. It is generated on demand and should be treated as a secret.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <div className="flex items-center justify-between pb-1.5 font-mono text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Terminal className="size-3.5" />
                Run on your Linux host with Docker installed:
              </span>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => void requestToken()}
                disabled={isLoading}
                className="h-6 gap-1 px-2 text-[11px]"
              >
                {isLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                <span>New token</span>
              </Button>
            </div>
            <CodeHighlighter
              language="bash"
              code={joinCommand}
              showLineNumbers={false}
              showCopy={Boolean(token)}
              maxHeight="max-h-40"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <output
            aria-live="polite"
            className="flex items-center gap-2 rounded-sm border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
          >
            <span className="relative flex size-2 shrink-0">
              {!newNodeConnected && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-50" />
              )}
              <span
                className={
                  newNodeConnected
                    ? "relative inline-flex size-2 rounded-full bg-emerald-500"
                    : "relative inline-flex size-2 rounded-full bg-primary"
                }
              />
            </span>
            <span>
              {newNodeConnected
                ? "A new node was registered. It should appear in the node list."
                : "Waiting for the agent to register. Keep this dialog open to verify the connection."}
            </span>
          </output>
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" size="sm">
                Close
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
