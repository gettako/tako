import type { Metadata } from "next"

import { ProjectsView } from "@/components/projects/projects-view"

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Organize edge services into isolated projects, environments, and deployment pipelines.",
}

export default function ProjectsPage() {
  return <ProjectsView />
}
