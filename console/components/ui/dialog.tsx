"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { XIcon } from "@phosphor-icons/react"

const dialogVariants = cva(
  "relative my-auto grid w-full max-w-[calc(100%-2rem)] gap-6 rounded-lg border border-border bg-card p-6 text-sm text-card-foreground duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
  {
    variants: {
      size: {
        sm: "sm:max-w-sm",
        md: "sm:max-w-md",
        default: "sm:max-w-lg",
        lg: "sm:max-w-xl",
        xl: "sm:max-w-2xl",
        "2xl": "sm:max-w-3xl",
        "3xl": "sm:max-w-4xl",
        "4xl": "sm:max-w-5xl",
        "5xl": "sm:max-w-6xl",
        "6xl": "sm:max-w-7xl",
        full: "sm:max-w-[calc(100%-3rem)]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const DialogContext = React.createContext<boolean>(false)

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return (
    <DialogContext.Provider value={true}>
      <DialogPrimitive.Root data-slot="dialog" {...props} />
    </DialogContext.Provider>
  )
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/60 backdrop-blur-xs duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogViewport({
  className,
  ...props
}: DialogPrimitive.Viewport.Props) {
  return (
    <DialogPrimitive.Viewport
      data-slot="dialog-viewport"
      className={cn(
        "fixed inset-0 isolate z-50 flex min-h-full justify-center overflow-y-auto p-4 sm:p-6 md:p-10",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  size = "default",
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props &
  VariantProps<typeof dialogVariants> & {
    showCloseButton?: boolean
  }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogViewport>
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(dialogVariants({ size }), className)}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={
                <Button
                  variant="ghost"
                  className="absolute top-4 right-4"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogViewport>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const inDialog = React.useContext(DialogContext)
  if (inDialog) {
    return (
      <DialogPrimitive.Title
        data-slot="dialog-title"
        className={cn(
          "font-heading text-lg leading-none font-semibold text-foreground",
          className
        )}
        {...props}
      />
    )
  }
  return (
    <h2
      data-slot="dialog-title"
      className={cn(
        "font-heading text-lg leading-none font-semibold text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  const inDialog = React.useContext(DialogContext)
  if (inDialog) {
    return (
      <DialogPrimitive.Description
        data-slot="dialog-description"
        className={cn(
          "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
          className
        )}
        {...props}
      />
    )
  }
  return (
    <p
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DialogViewport,
  dialogVariants,
}
