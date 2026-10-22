"use client"

import * as React from "react"

import { ErrorView } from "@/components/error/error-view"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    // Log unexpected runtime exception for telemetry tracing
    console.error("[Tako Error Boundary Caught]", error)
  }, [error])

  return (
    <ErrorView
      statusCode="500"
      title="Internal System Fault"
      description="An unhandled exception occurred in the platform runtime pipeline. Edge daemon processes and active container workloads remain isolated and operational."
      diagnosticInfo={{
        digest: error.digest,
        message: error.message,
      }}
      onReset={reset}
    />
  )
}
