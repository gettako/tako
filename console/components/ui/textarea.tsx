import * as React from "react"
import { cn } from "cn"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  error?: boolean | string
}

function Textarea({ className, error, ...props }: TextareaProps) {
  const isInvalid = props["aria-invalid"] === true || props["aria-invalid"] === "true" || !!error

  return (
    <textarea
      data-slot="textarea"
      aria-invalid={isInvalid ? "true" : undefined}
      data-invalid={isInvalid ? "true" : undefined}
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "md:text-sm dark:bg-card dark:border-border dark:text-foreground dark:placeholder:text-[#939DB8]",
        // Error validation state: prominent red border and red ring
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        "aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-3 aria-invalid:focus-visible:ring-destructive/30",
        "dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/30",
        "dark:aria-invalid:focus-visible:border-destructive dark:aria-invalid:focus-visible:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
