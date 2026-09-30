"use client"

import * as React from "react"
import { CopyIcon, CheckIcon } from "@phosphor-icons/react"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { cn } from "@/lib/utils"

export interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text: string
  label?: string
  copiedLabel?: string
  timeout?: number
  showIconOnly?: boolean
  size?: "xs" | "sm" | "default" | "icon" | "icon-sm"
  variant?: "ghost" | "outline" | "secondary" | "default"
}

export function CopyButton({
  text,
  label,
  copiedLabel = "Copied!",
  timeout = 2000,
  showIconOnly = false,
  size = "sm",
  variant = "ghost",
  className,
  onClick,
  title,
  "aria-label": ariaLabel,
  ...props
}: CopyButtonProps) {
  const { copy, isCopied, error } = useCopyToClipboard(timeout)

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onClick?.(e)
    await copy(text)
  }

  const effectiveAriaLabel =
    ariaLabel || title || (label ? `Copy ${label}` : "Copy to clipboard")

  const sizeClasses = {
    xs: "h-6 px-1.5 text-2xs gap-1",
    sm: "h-7 px-2 text-xs gap-1.5",
    default: "h-8 px-3 text-xs gap-2",
    icon: "size-8 p-0",
    "icon-sm": "size-7 p-0",
  }[size]

  const variantClasses = {
    ghost:
      "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
    outline:
      "border border-border bg-background text-foreground hover:bg-muted/60",
    secondary: "bg-muted text-muted-foreground hover:text-foreground",
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
  }[variant]

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center rounded-md font-medium transition-colors select-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          sizeClasses,
          variantClasses,
          isCopied && "text-emerald-600 dark:text-emerald-400",
          className
        )}
        title={title || (label ? `Copy ${label}` : "Copy")}
        aria-label={effectiveAriaLabel}
        {...props}
      >
        {isCopied ? (
          <CheckIcon
            className="size-3.5 shrink-0 text-emerald-500"
            aria-hidden="true"
          />
        ) : (
          <CopyIcon className="size-3.5 shrink-0" aria-hidden="true" />
        )}

        {!showIconOnly && label && (
          <span>{isCopied ? copiedLabel : label}</span>
        )}
      </button>

      {/* Accessible live region announcement */}
      <span className="sr-only" aria-live="polite">
        {isCopied
          ? `${label ? label + " " : ""}copied to clipboard`
          : error
            ? error
            : ""}
      </span>

      {/* Transient error tooltip if copy fails */}
      {error && (
        <div
          role="status"
          className="pointer-events-none absolute -top-7 left-1/2 z-50 -translate-x-1/2 rounded border border-border bg-destructive px-2 py-0.5 text-3xs font-medium whitespace-nowrap text-destructive-foreground"
        >
          Copy failed
        </div>
      )}
    </div>
  )
}
