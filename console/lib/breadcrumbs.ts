import type { ClusterNode, Project, ProjectService } from "@/types/platform"

export interface BreadcrumbDropdownItem {
  id: string
  label: string
  sublabel?: string
  href: string
  isCurrent?: boolean
}

export interface BreadcrumbItem {
  label: string
  href: string
  isCurrent: boolean
  dropdownItems?: BreadcrumbDropdownItem[]
}

interface BreadcrumbResources {
  nodes: ClusterNode[]
  projects: Project[]
  services: ProjectService[]
}

export function buildBreadcrumbs(
  pathname: string,
  { nodes, projects, services }: BreadcrumbResources
): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0 || segments[0] === "dashboard") {
    return [{ label: "Dashboard", href: "/dashboard", isCurrent: true }]
  }

  const section = segments[0]
  if (section === "nodes") {
    const nodeDropdownItems: BreadcrumbDropdownItem[] = nodes.map((n) => ({
      id: n.id,
      label: n.name,
      sublabel: `${n.location.name} • ${n.ipAddress}`,
      href: `/nodes/${n.id}`,
      isCurrent: segments[1] === n.id,
    }))

    if (segments.length === 1) {
      return [
        {
          label: "Nodes",
          href: "/nodes",
          isCurrent: true,
          dropdownItems: nodeDropdownItems,
        },
      ]
    }
    const nodeId = segments[1]
    const foundNode = nodes.find((n) => n.id === nodeId)
    return [
      { label: "Nodes", href: "/nodes", isCurrent: false },
      {
        label: foundNode ? foundNode.name : nodeId,
        href: `/nodes/${nodeId}`,
        isCurrent: true,
        dropdownItems: nodeDropdownItems,
      },
    ]
  }

  if (section === "projects") {
    const projectDropdownItems: BreadcrumbDropdownItem[] = projects.map(
      (p) => ({
        id: p.id,
        label: p.name,
        sublabel: `${p.environment} • ${p.servicesCount} services`,
        href: `/projects/${p.id}`,
        isCurrent: segments[1] === p.id,
      })
    )

    if (segments.length === 1) {
      return [
        {
          label: "Projects",
          href: "/projects",
          isCurrent: true,
          dropdownItems: projectDropdownItems,
        },
      ]
    }
    const projId = segments[1]
    const foundProj = projects.find((p) => p.id === projId)
    const projLabel = foundProj ? foundProj.name : projId

    if (segments.length >= 4 && segments[2] === "services") {
      const srvId = segments[3]
      const projectServices = services.filter((s) => s.projectId === projId)
      const foundSrv = services.find((s) => s.id === srvId)
      const srvLabel = foundSrv ? foundSrv.name : srvId

      const serviceDropdownItems: BreadcrumbDropdownItem[] =
        projectServices.map((s) => ({
          id: s.id,
          label: s.name,
          sublabel: s.type === "dockerfile" ? "Dockerfile" : "Docker Compose",
          href: `/projects/${projId}/services/${s.id}`,
          isCurrent: s.id === srvId,
        }))

      return [
        { label: "Projects", href: "/projects", isCurrent: false },
        {
          label: projLabel,
          href: `/projects/${projId}`,
          isCurrent: false,
          dropdownItems: projectDropdownItems,
        },
        {
          label: srvLabel,
          href: `/projects/${projId}/services/${srvId}`,
          isCurrent: true,
          dropdownItems: serviceDropdownItems,
        },
      ]
    }

    return [
      { label: "Projects", href: "/projects", isCurrent: false },
      {
        label: projLabel,
        href: `/projects/${projId}`,
        isCurrent: true,
        dropdownItems: projectDropdownItems,
      },
    ]
  }

  if (section === "monitor") {
    return [{ label: "Monitor", href: "/monitor", isCurrent: true }]
  }

  if (section === "audit-logs") {
    return [{ label: "Audit Logs", href: "/audit-logs", isCurrent: true }]
  }

  if (section === "settings") {
    return [{ label: "Settings", href: "/settings", isCurrent: true }]
  }

  if (section === "profile") {
    return [{ label: "Profile", href: "/profile", isCurrent: true }]
  }

  return [
    {
      label: section.replace("-", " "),
      href: pathname,
      isCurrent: true,
    },
  ]
}
