import { Suspense } from "react"
import { Metadata } from "next"

import { ClusterMonitorView } from "@/components/monitor/cluster-monitor-view"

export const metadata: Metadata = {
  title: "Cluster Monitor",
  description:
    "Real-time edge node telemetry, aggregate cluster compute, and gRPC stream monitoring.",
}

export default function MonitorPage() {
  return (
    <Suspense fallback={null}>
      <ClusterMonitorView />
    </Suspense>
  )
}
