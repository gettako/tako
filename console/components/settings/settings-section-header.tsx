"use client"

import * as React from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SettingsSectionHeaderProps {
  icon?: LucideIcon
  title: string
  description?: string
  badge?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function SettingsSectionHeader({
  icon: Icon,
  title,
  description,
  badge,
  action,
  className,
}: SettingsSectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
        )}
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
              {title}
            </h2>
            {badge}
          </div>
          {description && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>

      {action && (
        <div className="flex shrink-0 items-center gap-2 sm:self-center">
          {action}
        </div>
      )}
    </div>
  )
}
