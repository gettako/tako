import * as React from "react"
import { WarningCircleIcon } from "@phosphor-icons/react"
import { cn } from "cn"

export interface FieldErrorProps extends React.ComponentProps<"p"> {
  message?: string | null
}

export function FieldError({
  message,
  className,
  children,
  ...props
}: FieldErrorProps) {
  const content = message || children
  if (!content) return null

  return (
    <p
      role="alert"
      data-slot="field-error"
      className={cn(
        "flex items-center gap-1 text-xs text-destructive",
        className
      )}
      {...props}
    >
      <WarningCircleIcon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{content}</span>
    </p>
  )
}

export function FieldLabel({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label
      data-slot="field-label"
      className={cn("text-xs font-medium text-foreground", className)}
      {...props}
    >
      {children}
      {required && <span className="ml-1 text-destructive">*</span>}
    </label>
  )
}

export function FieldDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-2xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export function FieldGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}
