"use client"

import * as React from "react"
import "./globals.css"

import { ErrorView } from "@/components/error/error-view"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("[Tako Global Fatal Layout Error]", error)
  }, [error])

  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased">
        <ErrorView
          statusCode="500"
          title="Critical Root Layout Fault"
          description="A fatal error prevented the core platform shell from initializing. Edge nodes and running container workloads continue normal autonomous operation."
          diagnosticInfo={{
            digest: error.digest,
            message: error.message,
          }}
          onReset={reset}
        />
      </body>
    </html>
  )
}
