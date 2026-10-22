"use client"

import * as React from "react"
import { LayoutGrid, Table } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ViewModeToggleProps {
  mode: "grid" | "table"
  onModeChange: (mode: "grid" | "table") => void
  className?: string
}

export function ViewModeToggle({
  mode,
  onModeChange,
  className,
}: ViewModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="View mode toggle"
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5",
        className
      )}
    >
      <Button
        type="button"
        size="xs"
        variant={mode === "grid" ? "default" : "ghost"}
        onClick={() => onModeChange("grid")}
        className={cn(
          "h-7 gap-1.5 px-2.5 text-xs font-medium transition-colors",
          mode === "grid"
            ? "bg-background text-foreground shadow-xs hover:bg-background"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={mode === "grid"}
      >
        <LayoutGrid className="size-3.5" aria-hidden="true" />
        <span>Grid</span>
      </Button>

      <Button
        type="button"
        size="xs"
        variant={mode === "table" ? "default" : "ghost"}
        onClick={() => onModeChange("table")}
        className={cn(
          "h-7 gap-1.5 px-2.5 text-xs font-medium transition-colors",
          mode === "table"
            ? "bg-background text-foreground shadow-xs hover:bg-background"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={mode === "table"}
      >
        <Table className="size-3.5" aria-hidden="true" />
        <span>Table</span>
      </Button>
    </div>
  )
}
