"use client"

import * as React from "react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { toast } from "sonner"
import { deleteProject } from "@/lib/api/projects"
import { MoreHorizontalIcon, FolderIcon, Share2Icon, Trash2Icon } from "lucide-react"

export function NavProjects({
  projects,
  onProjectsChanged,
}: {
  projects: {
    id?: string
    name: string
    url: string
    icon: React.ReactNode
  }[]
  onProjectsChanged?: () => void
}) {
  const { isMobile, setOpenMobile } = useSidebar()

  const handleNavigate = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  const handleCopyLink = async (item: { name: string; url: string }) => {
    try {
      const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${item.url}` : item.url
      await navigator.clipboard.writeText(fullUrl)
      toast.success(`Project link for "${item.name}" copied`)
    } catch {
      toast.error('Failed to copy project link')
    }
  }

  const handleDelete = async (item: { id?: string; name: string; url: string }) => {
    const projId = item.id || item.url.split('/').pop() || ''
    if (!projId) return
    if (!confirm(`Are you sure you want to delete project "${item.name}"? This action cannot be undone.`)) {
      return
    }
    try {
      await deleteProject(projId)
      toast.success(`Project "${item.name}" deleted`)
      onProjectsChanged?.()
    } catch {
      toast.error(`Failed to delete project "${item.name}"`)
    }
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Services & Projects</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton
              render={
                <Link href={item.url} onClick={handleNavigate} />
              }
            >
              {item.icon}
              <span>{item.name}</span>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuAction
                    showOnHover
                    className="aria-expanded:bg-muted cursor-pointer"
                  />
                }
              >
                <MoreHorizontalIcon />
                <span className="sr-only">More</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem
                  render={
                    <Link
                      href={item.url}
                      className="flex items-center gap-2 cursor-pointer w-full"
                    />
                  }
                >
                  <FolderIcon className="size-4 text-muted-foreground" />
                  <span>View Project</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleCopyLink(item)}
                  className="cursor-pointer gap-2"
                >
                  <Share2Icon className="size-4 text-muted-foreground" />
                  <span>Copy Project URL</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  className="cursor-pointer text-status-danger gap-2"
                  onClick={() => handleDelete(item)}
                >
                  <Trash2Icon className="size-4" />
                  <span>Delete Project</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem>
          <SidebarMenuButton
            render={<Link href="/projects" onClick={handleNavigate} />}
            className="text-sidebar-foreground/70"
          >
            <MoreHorizontalIcon className="text-sidebar-foreground/70" />
            <span>View all projects</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
