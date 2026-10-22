import { Boxes, FileCode2, FolderGit2, Server } from "lucide-react"

import {
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"
import { statusDotClass } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { ClusterNode, Project, ProjectService } from "@/types/platform"

interface CommandResourceGroupsProps {
  nodes: ClusterNode[]
  projects: Project[]
  services: ProjectService[]
  onNavigate: (href: string) => void
}

export function CommandResourceGroups({
  nodes,
  projects,
  services,
  onNavigate,
}: CommandResourceGroupsProps) {
  return (
    <>
      {projects.length > 0 && (
        <>
          <CommandSeparator className="my-1.5" />
          <CommandGroup heading="Projects">
            {projects.map((project) => (
              <CommandItem
                key={project.id}
                onSelect={() => onNavigate(`/projects/${project.id}`)}
                className="cursor-pointer gap-2.5 py-2"
              >
                <FolderGit2 className="size-4 shrink-0 text-primary" />
                <span className="truncate font-medium text-foreground">
                  {project.name}
                </span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {project.slug}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                  {project.healthyServicesCount}/{project.servicesCount} healthy
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </>
      )}

      {services.length > 0 && (
        <>
          <CommandSeparator className="my-1.5" />
          <CommandGroup heading="Services">
            {services.map((service) => {
              const targetNode = nodes.find(
                (node) => node.id === service.targetNodeId
              )

              return (
                <CommandItem
                  key={service.id}
                  onSelect={() =>
                    onNavigate(
                      `/projects/${service.projectId}/services/${service.id}`
                    )
                  }
                  className="cursor-pointer gap-2.5 py-2"
                >
                  {service.type === "dockerfile" ? (
                    <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Boxes className="size-4 shrink-0 text-emerald-500" />
                  )}
                  <span className="truncate font-medium text-foreground">
                    {service.name}
                  </span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                    {service.type === "dockerfile" ? "Dockerfile" : "Compose"}
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {targetNode ? targetNode.name : service.targetNodeId}
                    </span>
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        statusDotClass(service.status)
                      )}
                    />
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        </>
      )}

      {nodes.length > 0 && (
        <>
          <CommandSeparator className="my-1.5" />
          <CommandGroup heading="Nodes">
            {nodes.map((node) => (
              <CommandItem
                key={node.id}
                onSelect={() => onNavigate(`/nodes/${node.id}`)}
                className="cursor-pointer gap-2.5 py-2"
              >
                <Server className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium text-foreground">
                  {node.name}
                </span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                  {node.role}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {node.ipAddress}
                  </span>
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      statusDotClass(node.status)
                    )}
                  />
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </>
      )}
    </>
  )
}
