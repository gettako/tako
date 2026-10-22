import type { Metadata } from "next"

import { ProjectServicesView } from "@/components/projects/project-services-view"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>
}): Promise<Metadata> {
  const { projectId } = await params
  return {
    title: `Project Details · ${projectId}`,
    description: "Project services and edge workloads.",
  }
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  return <ProjectServicesView projectId={projectId} />
}
