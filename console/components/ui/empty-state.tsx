"use client"

import * as React from "react"
import { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 p-8 text-center sm:p-12",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-xs">
        <Icon className="size-6 text-foreground/80" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>

      <p className="mt-1.5 max-w-sm text-sm leading-normal text-muted-foreground">
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {actionLabel && onAction && (
            <Button onClick={onAction} size="sm">
              {actionLabel}
            </Button>
          )}

          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
