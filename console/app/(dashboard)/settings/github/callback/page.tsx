"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  GithubLogoIcon,
  CircleNotchIcon,
  CheckCircleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { api, ApiError } from "@/lib/api"

function GitHubCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const code = searchParams.get("code")

  const [status, setStatus] = React.useState<"loading" | "success" | "error">(
    "loading"
  )
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [installUrl, setInstallUrl] = React.useState<string | null>(null)

  const executedRef = React.useRef(false)

  React.useEffect(() => {
    if (executedRef.current) return
    executedRef.current = true

    if (!code) {
      setStatus("error")
      setErrorMessage("No temporary code was provided by GitHub.")
      return
    }

    const exchangeCode = async () => {
      try {
        const resp = await api.github.exchangeManifest({ code })
        setStatus("success")
        setInstallUrl(resp.install_url)

        // Automatically redirect to GitHub App installation screen after a brief delay
        setTimeout(() => {
          if (resp.install_url) {
            window.location.href = resp.install_url
          } else {
            router.push("/settings/github")
          }
        }, 1200)
      } catch (err) {
        setStatus("error")
        if (err instanceof ApiError) {
          setErrorMessage(err.message)
        } else if (err instanceof Error) {
          setErrorMessage(err.message)
        } else {
          setErrorMessage("Failed to exchange GitHub App manifest credentials.")
        }
      }
    }

    void exchangeCode()
  }, [code, router])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-muted/40">
          <GithubLogoIcon className="size-6 text-foreground" />
        </div>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <CircleNotchIcon className="size-6 animate-spin text-primary" />
            <h1 className="font-heading text-lg font-semibold text-foreground">
              Connecting GitHub App
            </h1>
            <p className="text-xs text-muted-foreground">
              Registering application credentials and configuring webhook
              secrets...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircleIcon className="size-6 text-emerald-500" />
            <h1 className="font-heading text-lg font-semibold text-foreground">
              GitHub App Created Successfully
            </h1>
            <p className="text-xs text-muted-foreground">
              Redirecting to GitHub to install on your organization or personal
              account...
            </p>
            {installUrl && (
              <a
                href={installUrl}
                className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Continue to Install on GitHub
              </a>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3">
            <WarningCircleIcon className="size-6 text-destructive" />
            <h1 className="font-heading text-lg font-semibold text-foreground">
              Connection Failed
            </h1>
            <p className="text-xs text-destructive">
              {errorMessage ||
                "An unexpected error occurred while setting up the GitHub App."}
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/settings/github"
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                Back to Settings
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function GitHubCallbackPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
          <CircleNotchIcon className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <GitHubCallbackContent />
    </React.Suspense>
  )
}
