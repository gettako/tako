import type { Metadata } from "next"

import { NodesView } from "@/components/nodes/nodes-view"

export const metadata: Metadata = {
  title: "Nodes",
  description:
    "Manage physical and cloud servers running the Tako Golang edge telemetry agent.",
}

export default function NodesPage() {
  return <NodesView />
}
