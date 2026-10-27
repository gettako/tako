import type { Metadata } from "next"

import { ErrorView } from "@/components/error/error-view"

export const metadata: Metadata = {
  title: "500 - Internal System Fault",
  description: "An unexpected system error occurred on this Tako cluster.",
}

export default function InternalErrorPage() {
  const isDev = process.env.NODE_ENV === "development"

  return (
    <ErrorView
      statusCode="500"
      title="Internal System Fault"
      description="An unhandled exception occurred in the platform runtime pipeline. Edge daemon processes and active container workloads remain isolated and operational."
      diagnosticInfo={{
        digest: "ERR_500_DAEMON_TIMEOUT",
        message:
          "Internal execution timeout occurred during telemetry state reconciliation.",
        stack: isDev
          ? `Error: Internal execution timeout during telemetry state reconciliation
    at reconcileClusterState (app/lib/telemetry.ts:142:18)
    at async dispatchEdgeCommand (app/lib/adapters.ts:88:9)
    at async RouteHandler (app/api/v1/[...path]/route.ts:45:12)`
          : undefined,
      }}
    />
  )
}
