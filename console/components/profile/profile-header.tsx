"use client"

import * as React from "react"
import { Check, Clock, Copy, Globe, Mail, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { usePlatformData } from "@/context/platform-data-context"
import { copyToClipboard } from "@/lib/clipboard"
import { getInitials } from "@/lib/user"

export function ProfileHeader() {
  const { currentUser } = usePlatformData()
  const [copiedId, setCopiedId] = React.useState(false)

  const initials = getInitials(currentUser.name, "OP")

  const handleCopyId = () => {
    void copyToClipboard(currentUser.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-xs">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Avatar Block */}
          <div className="relative flex size-16 shrink-0 items-center justify-center rounded-full border-2 border-border bg-primary/10 font-mono text-xl font-bold text-primary shadow-xs">
            <span>{initials}</span>
            <span
              className="absolute -right-0.5 -bottom-0.5 size-4 rounded-full border-2 border-card bg-emerald-500"
              title="Operator Active & Verified"
            />
          </div>

          {/* Profile Identity Details */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {currentUser.name}
              </h1>
              <span className="font-mono text-xs text-muted-foreground">
                @{currentUser.handle}
              </span>
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary capitalize">
                {currentUser.role === "owner"
                  ? "Cluster Owner"
                  : "Platform Admin"}
              </span>
              {currentUser.twoFactorEnabled && (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-500">
                  <ShieldCheck className="size-3" />
                  <span>2FA Enforced</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-mono text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="size-3 text-primary" />
                <span>{currentUser.email}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Globe className="size-3 text-muted-foreground" />
                <span>{currentUser.timezone}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3 text-muted-foreground" />
                <span>Operator since {currentUser.createdAt}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleCopyId}
            className="gap-1.5 font-mono text-xs"
            title="Copy Operator User ID"
          >
            {copiedId ? (
              <Check className="size-3 text-emerald-500" />
            ) : (
              <Copy className="size-3 text-muted-foreground" />
            )}
            <span>{currentUser.id}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
