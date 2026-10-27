import type { Metadata } from "next"

import { ServiceDetailView } from "@/components/services/service-detail-view"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string; serviceId: string }>
}): Promise<Metadata> {
  const { serviceId } = await params
  return {
    title: `Service Details · ${serviceId}`,
    description:
      "Edge service telemetry, container status, and deployment controls.",
  }
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ projectId: string; serviceId: string }>
}) {
  const { projectId, serviceId } = await params
  return <ServiceDetailView projectId={projectId} serviceId={serviceId} />
}
