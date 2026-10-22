import type { Metadata } from "next"

import { ErrorView } from "@/components/error/error-view"

export const metadata: Metadata = {
  title: "500 - Internal System Fault",
  description: "An unexpected system error occurred on this Tako cluster.",
}

export default function InternalErrorPage() {
  return (
    <ErrorView
      statusCode="500"
      title="Internal System Fault"
      description="An unhandled exception occurred in the platform runtime pipeline. Edge daemon processes and active container workloads remain isolated and operational."
      diagnosticInfo={{
        digest: "ERR_500_DAEMON_TIMEOUT",
        message:
          "Internal execution timeout occurred during telemetry state reconciliation.",
      }}
    />
  )
}
