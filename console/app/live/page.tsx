import type { Metadata } from "next"

import { LiveTrafficView } from "@/components/live/live-traffic-view"

export const metadata: Metadata = {
  title: "Cluster Topology & Telemetry",
  description:
    "Real-time cluster node geographic distribution, connection latency, and live telemetry stream.",
}

export default function LivePage() {
  return <LiveTrafficView />
}
