"use client"

import * as React from "react"
import { ChevronDown, FileCode2, Boxes, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ServiceType } from "@/types/platform"
import { cn } from "@/lib/utils"

interface CreateServiceDropdownProps {
  onSelectType: (type: ServiceType) => void
  className?: string
  size?: "sm" | "md"
}

export function CreateServiceDropdown({
  onSelectType,
  className,
  size = "md",
}: CreateServiceDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown on outside click or Escape key
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleKeyDown)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (type: ServiceType) => {
    setIsOpen(false)
    onSelectType(type)
  }

  return (
    <div className={cn("relative inline-flex", className)} ref={menuRef}>
      {/* Primary Split Button */}
      <Button
        type="button"
        size={size}
        onClick={() => handleSelect("dockerfile")}
        className="gap-1.5 rounded-r-none text-xs font-medium"
      >
        <Plus className="size-3.5" />
        <span>New Service</span>
      </Button>

      {/* Dropdown Chevron Toggle */}
      <Button
        type="button"
        size={size}
        onClick={() => setIsOpen((prev) => !prev)}
        className="rounded-l-none border-l border-primary-foreground/20 px-2 text-xs"
        aria-label="Select service deployment type"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform duration-150",
            isOpen && "rotate-180"
          )}
        />
      </Button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute top-full right-0 z-50 mt-1 w-80 animate-in rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md fade-in-50 zoom-in-95"
        >
          <div className="px-2 py-1 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Deployment Model
          </div>

          {/* Option 1: Application (Dockerfile / Repo) */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect("dockerfile")}
            className="flex w-full items-start gap-3 rounded-sm p-2 text-left transition-colors hover:bg-muted/60 focus:bg-muted/60 focus:outline-none"
          >
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-sm border border-primary/20 bg-primary/10 text-primary">
              <FileCode2 className="size-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Application
                </span>
                <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary">
                  Single Container
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Deploy from a GitHub repository, public Git URL, or custom
                Dockerfile context.
              </p>
            </div>
          </button>

          {/* Option 2: Docker Compose */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect("docker-compose")}
            className="mt-0.5 flex w-full items-start gap-3 rounded-sm p-2 text-left transition-colors hover:bg-muted/60 focus:bg-muted/60 focus:outline-none"
          >
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-sm border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
              <Boxes className="size-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  Docker Compose
                </span>
                <span className="rounded-sm bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  Compose Stack
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Multi-container stack orchestrating microservices, networks, and
                persistent volumes.
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
