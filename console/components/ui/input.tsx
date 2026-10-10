import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

export interface InputProps extends React.ComponentProps<"input"> {
  error?: boolean | string
}

function Input({ className, type, error, ...props }: InputProps) {
  const isInvalid = props["aria-invalid"] === true || props["aria-invalid"] === "true" || !!error

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      aria-invalid={isInvalid ? "true" : undefined}
      data-invalid={isInvalid ? "true" : undefined}
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
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

export { Input }
