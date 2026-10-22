import type { Metadata } from "next"

import { LiveTrafficView } from "@/components/live/live-traffic-view"

export const metadata: Metadata = {
  title: "Live Telemetry",
  description:
    "Real-time edge network topology, node telemetry stream, and cluster outage simulation.",
}

export default function LivePage() {
  return <LiveTrafficView />
}
