"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { BookOpen, Moon, Sun } from "lucide-react"

import { CommandResourceGroups } from "@/components/command-palette/command-resource-groups"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { navigationGroups } from "@/config/navigation"
import { usePlatformData } from "@/context/platform-data-context"
import { useCommandPalette } from "@/hooks/use-command-palette"

export function GlobalCommandPalette() {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { open, setOpen } = useCommandPalette()
  const { nodes, projects, services } = usePlatformData()

  const isDark = resolvedTheme === "dark"

  const runCommand = React.useCallback(
    (command: () => void) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  const goTo = React.useCallback(
    (href: string) => runCommand(() => router.push(href)),
    [runCommand, router]
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Global Command Palette"
      description="Search across projects, services, and nodes, or navigate the console"
      className="max-w-[calc(100%-2rem)] p-0 sm:max-w-xl"
    >
      <Command>
        <CommandInput
          placeholder="Type a command or search console..."
          wrapperClassName="p-1 pb-2.5"
        />
        <CommandList className="max-h-[420px] px-1 pb-1">
          <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
            No matching resources or commands found.
          </CommandEmpty>

          <CommandGroup heading="Quick Actions">
            <CommandItem
              onSelect={() =>
                runCommand(() => setTheme(isDark ? "light" : "dark"))
              }
              className="cursor-pointer gap-2.5 py-2"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground">
                {isDark ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-foreground">
                  Switch to {isDark ? "light" : "dark"} theme
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Toggle console color scheme
                </span>
              </div>
              <CommandShortcut>Theme</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  window.open(
                    "https://docs.gettako.dev",
                    "_blank",
                    "noopener,noreferrer"
                  )
                })
              }
              className="cursor-pointer gap-2.5 py-2"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground">
                <BookOpen className="size-4" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-foreground">
                  Open documentation
                </span>
                <span className="text-[11px] text-muted-foreground">
                  docs.gettako.dev in a new tab
                </span>
              </div>
            </CommandItem>
          </CommandGroup>

          {navigationGroups.map((group) => (
            <React.Fragment key={group.title}>
              <CommandSeparator className="my-1.5" />
              <CommandGroup heading={group.title}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    onSelect={() => goTo(item.href)}
                    className="cursor-pointer gap-2.5 py-2"
                  >
                    <item.icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">
                      {item.commandLabel ?? item.name}
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground/60">
                      {item.href}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          ))}

          <CommandResourceGroups
            nodes={nodes}
            projects={projects}
            services={services}
            onNavigate={goTo}
          />
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
