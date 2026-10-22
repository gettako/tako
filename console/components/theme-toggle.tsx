"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { MoonIcon, SunIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

const emptySubscribe = () => () => {}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`size-8 rounded-md text-muted-foreground ${className}`}
        aria-label="Toggle theme"
        disabled
      >
        <span className="size-4" />
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative size-8 rounded-md text-muted-foreground transition-colors hover:text-foreground ${className}`}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <SunIcon className="size-4 scale-100 rotate-0 transition-all duration-300 dark:scale-0 dark:-rotate-90" />
      <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-all duration-300 dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
