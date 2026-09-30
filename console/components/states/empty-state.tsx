import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode
  title: string
  description?: string
  action?:
    | React.ReactNode
    | {
        label: string
        onClick?: () => void
        href?: string
      }
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  const renderIcon = () => {
    if (!Icon) return null
    if (React.isValidElement(Icon)) {
      return (
        <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground">
          {Icon}
        </div>
      )
    }
    const IconComponent = Icon as React.ComponentType<{ className?: string }>
    return (
      <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground">
        <IconComponent className="size-6 text-foreground" />
      </div>
    )
  }

  const renderAction = () => {
    if (!action) return null
    if (React.isValidElement(action)) {
      return <div className="mt-6">{action}</div>
    }
    const actionObj = action as {
      label: string
      onClick?: () => void
      href?: string
    }

    if (actionObj.href) {
      return (
        <div className="mt-6">
          <Button render={<a href={actionObj.href} />}>
            {actionObj.label}
          </Button>
        </div>
      )
    }

    return (
      <div className="mt-6">
        <Button onClick={actionObj.onClick}>{actionObj.label}</Button>
      </div>
    )
  }

  return (
    <div
      role="region"
      aria-label={title}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-12 text-center",
        className
      )}
      {...props}
    >
      {renderIcon()}
      <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {renderAction()}
    </div>
  )
}
