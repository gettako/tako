"use client"

import * as React from "react"
import {
  CaretDownIcon,
  CaretUpIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react"
import type { EnvVar } from "@/lib/api"
import { cn } from "@/lib/utils"

export type EnvChangeType = "added" | "removed" | "changed"

export interface EnvDiffItem {
  key: string
  changeType: EnvChangeType
  oldValue?: string
  newValue?: string
  isSecret: boolean
}

export function computeEnvDiff(
  currentSnapshot?: EnvVar[] | null,
  previousSnapshot?: EnvVar[] | null
): EnvDiffItem[] {
  if (!previousSnapshot || !currentSnapshot) {
    return []
  }

  const prevMap = new Map<string, EnvVar>()
  for (const v of previousSnapshot) {
    prevMap.set(v.key, v)
  }

  const currMap = new Map<string, EnvVar>()
  for (const v of currentSnapshot) {
    currMap.set(v.key, v)
  }

  const diffs: EnvDiffItem[] = []

  // Check added and changed
  for (const curr of currentSnapshot) {
    const prev = prevMap.get(curr.key)
    if (!prev) {
      diffs.push({
        key: curr.key,
        changeType: "added",
        newValue: curr.value,
        isSecret: curr.is_secret,
      })
    } else if (prev.value !== curr.value || prev.is_secret !== curr.is_secret) {
      diffs.push({
        key: curr.key,
        changeType: "changed",
        oldValue: prev.value,
        newValue: curr.value,
        isSecret: curr.is_secret || prev.is_secret,
      })
    }
  }

  // Check removed
  for (const prev of previousSnapshot) {
    if (!currMap.has(prev.key)) {
      diffs.push({
        key: prev.key,
        changeType: "removed",
        oldValue: prev.value,
        isSecret: prev.is_secret,
      })
    }
  }

  // Sort by key for predictable display
  return diffs.sort((a, b) => a.key.localeCompare(b.key))
}

export function formatEnvValue(value?: string, isSecret?: boolean): string {
  if (value === undefined || value === null) return "(none)"
  if (isSecret) return "••••••"
  return value
}

interface EnvDiffPillProps {
  count: number
  isExpanded: boolean
  onToggle: () => void
  deploymentId: string
}

export function EnvDiffPill({
  count,
  isExpanded,
  onToggle,
  deploymentId,
}: EnvDiffPillProps) {
  if (count <= 0) return null

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isExpanded}
      aria-controls={`env-diff-${deploymentId}`}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        isExpanded
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-muted/70 text-foreground hover:bg-muted"
      )}
    >
      <SlidersHorizontalIcon className="size-3" aria-hidden="true" />
      <span>{`Env Changes (${count})`}</span>
      {isExpanded ? (
        <CaretUpIcon className="size-3" aria-hidden="true" />
      ) : (
        <CaretDownIcon className="size-3" aria-hidden="true" />
      )}
    </button>
  )
}

interface EnvDiffPanelProps {
  diffs: EnvDiffItem[]
  deploymentId: string
}

export function EnvDiffPanel({ diffs, deploymentId }: EnvDiffPanelProps) {
  if (diffs.length === 0) return null

  return (
    <div
      id={`env-diff-${deploymentId}`}
      role="region"
      aria-label="Environment variable differences"
      className="flex flex-col gap-3 border-t border-border bg-muted/20 p-4 transition-all"
    >
      <div className="flex items-center justify-between">
        <h4 className="font-heading text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {`Environment Variable Changes (${diffs.length})`}
        </h4>
        <span className="text-2xs text-muted-foreground">
          Compared to previous deployment
        </span>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded border border-border bg-card">
        {diffs.map((diff) => {
          const isAdded = diff.changeType === "added"
          const isRemoved = diff.changeType === "removed"
          const isChanged = diff.changeType === "changed"

          return (
            <div
              key={diff.key}
              className="flex flex-col justify-between gap-2 p-2.5 font-mono text-xs sm:flex-row sm:items-center"
            >
              {/* Left: Key and badge */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded border px-2 py-0.5 text-2xs leading-none font-semibold uppercase",
                    isAdded &&
                      "border-status-healthy-border bg-status-healthy-bg text-status-healthy-text",
                    isRemoved &&
                      "border-status-failed-border bg-status-failed-bg text-status-failed-text",
                    isChanged &&
                      "border-status-queued-border bg-status-queued-bg text-status-queued-text"
                  )}
                >
                  {diff.changeType}
                </span>

                <span className="font-semibold text-foreground">
                  {diff.key}
                </span>

                {diff.isSecret && (
                  <span className="py-0.2 rounded border border-border bg-muted px-1.5 text-2xs text-muted-foreground">
                    secret
                  </span>
                )}
              </div>

              {/* Right: Old / New values */}
              <div className="flex max-w-full items-center gap-2 truncate text-xs sm:max-w-md">
                {isAdded && (
                  <span className="truncate font-mono text-status-healthy-text">
                    {`+ ${formatEnvValue(diff.newValue, diff.isSecret)}`}
                  </span>
                )}

                {isRemoved && (
                  <span className="truncate font-mono text-status-failed-text line-through opacity-80">
                    {`- ${formatEnvValue(diff.oldValue, diff.isSecret)}`}
                  </span>
                )}

                {isChanged && (
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="max-w-[140px] truncate font-mono text-muted-foreground line-through">
                      {formatEnvValue(diff.oldValue, diff.isSecret)}
                    </span>
                    <span className="text-muted-foreground" aria-hidden="true">
                      &rarr;
                    </span>
                    <span className="max-w-[140px] truncate font-mono font-medium text-status-queued-text">
                      {formatEnvValue(diff.newValue, diff.isSecret)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
