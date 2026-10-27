import type { Metadata } from "next"

import { ErrorView } from "@/components/error/error-view"

export const metadata: Metadata = {
  title: "503 - Service Unavailable",
  description:
    "The target edge node or cluster control plane is temporarily unavailable.",
}

export default function ServiceUnavailableRoutePage() {
  return (
    <ErrorView
      statusCode="503"
      title="Cluster Node Unavailable"
      description="The target edge cluster node is temporarily draining active connections or undergoing scheduled rolling maintenance. Autonomous local containers remain running."
      diagnosticInfo={{
        digest: "NODE_DRAIN_IN_PROGRESS",
        message:
          "Edge daemon reported state: DRAINING_ACTIVE_TRAFFIC (node-sg01).",
      }}
    />
  )
}
