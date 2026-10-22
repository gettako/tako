"use client"

import * as React from "react"
import Link from "next/link"
import { BookOpen, ExternalLink, LogOut, Settings, User } from "lucide-react"

import { usePlatformData } from "@/context/platform-data-context"
import { getInitials } from "@/lib/user"
import { cn } from "@/lib/utils"

export function UserMenu() {
  const { currentUser } = usePlatformData()
  const [open, setOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Close the dropdown on outside click or Escape
  React.useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const initials = getInitials(currentUser?.name, "SI")

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Account profile & options"
        className={cn(
          "relative flex size-8 items-center justify-center rounded-full border border-border bg-muted/50 text-xs font-semibold text-foreground transition-all hover:border-primary/50 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
          open && "border-primary ring-2 ring-primary/20"
        )}
      >
        <span className="font-mono text-xs font-bold text-foreground">
          {initials}
        </span>
        <span
          className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-500"
          title="Cluster Admin Online"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute top-full right-0 z-50 mt-2 w-64 animate-in rounded-lg border border-border bg-card p-1.5 fade-in-0 zoom-in-95"
        >
          {/* User Profile Header */}
          <div className="border-b border-border px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 font-mono text-xs font-bold text-primary">
                {initials}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-bold text-foreground">
                  {currentUser?.name || "Supian M"}
                </span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {currentUser?.email || "operator@gettako.dev"}
                </span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary capitalize">
                {currentUser?.role === "owner"
                  ? "Cluster Owner"
                  : "Operator Admin"}
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-500">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="py-1">
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <User className="size-3.5 text-muted-foreground" />
              <span>Profile & Account</span>
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Settings className="size-3.5 text-muted-foreground" />
              <span>Cluster Settings</span>
            </Link>
            <a
              href="https://docs.gettako.dev"
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="size-3.5 text-muted-foreground" />
                <span>Documentation</span>
              </div>
              <ExternalLink className="size-3 text-muted-foreground/60" />
            </a>
          </div>

          {/* Logout Row */}
          <div className="border-t border-border pt-1">
            <Link
              href="/login"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-3.5" />
              <span>Log out</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
