"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, ExternalLink, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { sidebarNavigationGroups } from "@/config/navigation"
import { siteConfig } from "@/config/site"
import { isNavigationItemActive } from "@/lib/navigation"
import { cn } from "@/lib/utils"

interface MobileNavigationProps {
  open: boolean
  onClose: () => void
  navBadges: Record<string, string | undefined>
}

export function MobileNavigation({
  open,
  onClose,
  navBadges,
}: MobileNavigationProps) {
  const pathname = usePathname()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        className="fixed inset-0 h-full w-full cursor-default border-none bg-black/60 p-0 backdrop-blur-xs"
        onClick={onClose}
      />

      <div className="relative z-10 h-full w-72 border-r border-border bg-card p-4">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2 font-semibold"
          >
            <Image
              src="/images/tako-trim.png"
              alt={siteConfig.name}
              width={28}
              height={28}
              className="size-7 rounded-sm object-contain"
            />
            <span className="text-sm font-bold">{siteConfig.name}</span>
          </Link>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="mt-4 space-y-4">
          {sidebarNavigationGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 pb-1 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {group.title}
              </div>
              {group.items.map((item) => {
                const active = isNavigationItemActive(pathname, item.href)
                const badge = navBadges[item.href]
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium",
                      active
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="size-4 shrink-0" />
                      <span>{item.name}</span>
                    </div>
                    {badge && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-xs",
                          active
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}

          <div className="border-t border-border pt-2">
            <a
              href="https://docs.gettako.dev"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="size-4 shrink-0" />
                <span>Documentation</span>
              </div>
              <ExternalLink className="size-3.5 text-muted-foreground/60" />
            </a>
          </div>
        </nav>
      </div>
    </div>
  )
}
