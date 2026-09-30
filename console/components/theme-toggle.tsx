"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { SunIcon, MoonIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

const emptySubscribe = () => () => {}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-md border border-border bg-transparent text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:size-9",
        className
      )}
    >
      {mounted ? (
        resolvedTheme === "dark" ? (
          <SunIcon size={18} weight="regular" aria-hidden="true" />
        ) : (
          <MoonIcon size={18} weight="regular" aria-hidden="true" />
        )
      ) : (
        <span className="size-4.5" aria-hidden="true" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
