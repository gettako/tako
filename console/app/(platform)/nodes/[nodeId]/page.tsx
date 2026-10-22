import type { Metadata } from "next"

import { NodeDetailView } from "@/components/nodes/node-detail-view"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ nodeId: string }>
}): Promise<Metadata> {
  const { nodeId } = await params
  return {
    title: `Node Details · ${nodeId}`,
    description: `Edge telemetry metrics, container workloads, and daemon state for ${nodeId}.`,
  }
}

export default async function NodeDetailPage({
  params,
}: {
  params: Promise<{ nodeId: string }>
}) {
  const { nodeId } = await params
  return <NodeDetailView nodeId={nodeId} />
}
