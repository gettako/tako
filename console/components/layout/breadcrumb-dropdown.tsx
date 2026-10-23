"use client"

import * as React from "react"
import Link from "next/link"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Route } from "next"
import type { BreadcrumbDropdownItem } from "@/lib/breadcrumbs"

interface BreadcrumbDropdownProps {
  label: string
  href: Route
  isCurrent: boolean
  items: BreadcrumbDropdownItem[]
}

export function BreadcrumbDropdown({
  label,
  href,
  isCurrent,
  items,
}: BreadcrumbDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown on outside click or Escape
  React.useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {isCurrent ? (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className={cn(
            "group inline-flex max-w-[200px] items-center gap-1 rounded px-1.5 py-0.5 font-medium text-foreground transition-colors hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden sm:max-w-[260px]",
            isOpen && "bg-muted text-foreground"
          )}
          title={`Switch service (currently ${label})`}
        >
          <span className="truncate">{label}</span>
          <ChevronDown
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:text-foreground",
              isOpen && "rotate-180 text-foreground"
            )}
          />
        </button>
      ) : (
        <div className="inline-flex items-center rounded transition-colors hover:bg-muted/60">
          <Link
            href={href}
            className="max-w-[130px] truncate px-1 py-0.5 transition-colors hover:text-foreground hover:underline"
            title={label}
          >
            {label}
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-haspopup="menu"
            className={cn(
              "rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden",
              isOpen && "bg-muted text-foreground"
            )}
            title={`Switch project (currently ${label})`}
          >
            <ChevronDown
              className={cn(
                "size-3 transition-transform duration-150",
                isOpen && "rotate-180"
              )}
            />
          </button>
        </div>
      )}

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute top-full left-0 z-50 mt-1 max-w-[320px] min-w-[220px] animate-in rounded-md border border-border bg-popover p-1 shadow-lg ring-1 ring-black/5 fade-in-0 zoom-in-95"
        >
          <div className="max-h-60 overflow-y-auto py-0.5">
            {items.map((item) => {
              const active = item.isCurrent
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  role="menuitem"
                  className={cn(
                    "flex items-center justify-between gap-2.5 rounded px-2.5 py-1.5 text-xs transition-colors",
                    active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="truncate font-mono text-[10px] text-muted-foreground">
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                  {active && (
                    <Check className="size-3.5 shrink-0 text-primary" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
