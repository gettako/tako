import * as React from "react"
import { WarningCircleIcon, ArrowClockwiseIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

export interface ErrorCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  message?: string
  code?: string
  error?: Error | ApiError | string | null
  onRetry?: () => void
  retryLabel?: string
}

export function ErrorCard({
  title = "Something went wrong",
  message,
  code,
  error,
  onRetry,
  retryLabel = "Try again",
  className,
  ...props
}: ErrorCardProps) {
  let displayMessage = message
  let displayCode = code

  if (error) {
    if (error instanceof ApiError) {
      displayMessage = displayMessage ?? error.message
      displayCode = displayCode ?? error.code
    } else if (error instanceof Error) {
      displayMessage = displayMessage ?? error.message
    } else if (typeof error === "string") {
      displayMessage = displayMessage ?? error
    }
  }

  displayMessage =
    displayMessage ?? "An unexpected error occurred. Please try again."

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-foreground",
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
          <WarningCircleIcon className="size-5" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-heading text-sm font-semibold tracking-tight text-foreground">
              {title}
            </h4>
            {displayCode && (
              <span className="font-mono text-xs text-red-600 dark:text-red-400">
                {`(${displayCode})`}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{displayMessage}</p>
        </div>
      </div>

      {onRetry && (
        <div className="flex justify-end pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-red-500/30 text-xs hover:bg-red-500/10 hover:text-foreground"
          >
            <ArrowClockwiseIcon className="size-3.5" />
            <span>{retryLabel}</span>
          </Button>
        </div>
      )}
    </div>
  )
}
