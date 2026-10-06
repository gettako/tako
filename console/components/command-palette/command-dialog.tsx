'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import {
  Folder,
  Server,
  HardDrive,
  Activity,
  FileText,
  Settings,
  User,
  Sun,
  Moon,
  Plus,
  Play,
  LayoutDashboard,
  Search,
  ExternalLink,
} from 'lucide-react';
import {
  Command,
  CommandDialog as BaseCommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { getProjects } from '@/lib/api/projects';
import { getServices } from '@/lib/api/services';
import { getNodes } from '@/lib/api/nodes';
import { cn } from '@/lib/utils';

export function GlobalCommandPalette() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { open, setOpen } = useCommandPalette();

  // Queries for live index
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
    enabled: open,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => getServices(),
    enabled: open,
  });

  const { data: nodes = [] } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => getNodes(),
    enabled: open,
  });

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'healthy':
        return 'bg-status-success';
      case 'unhealthy':
      case 'offline':
      case 'failed':
        return 'bg-status-danger';
      case 'degraded':
      case 'warning':
        return 'bg-status-warning';
      case 'deploying':
      case 'running':
        return 'bg-status-info';
      default:
        return 'bg-status-neutral';
    }
  };

  return (
    <BaseCommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Global Command Palette"
      description="Search across projects, services, nodes, and execute quick administrative actions"
      className="max-w-2xl bg-background/80 backdrop-blur-md border border-border/60 shadow-2xl p-0 overflow-hidden"
    >
      <Command className="bg-transparent border-0">
        <CommandInput placeholder="Type a command or search console..." className="h-12 text-sm" />
        <CommandList className="max-h-[380px] p-2">
          <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
            No matching resources or commands found.
          </CommandEmpty>

          {/* Quick Actions */}
          <CommandGroup heading="Quick Actions">
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  router.push('/projects');
                })
              }
              className="gap-3 py-2.5 cursor-pointer"
            >
              <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Plus className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">Create new project...</span>
                <span className="text-[11px] text-muted-foreground">Initialize container project with Git repo</span>
              </div>
            </CommandItem>

            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  setTheme(theme === 'dark' ? 'light' : 'dark');
                })
              }
              className="gap-3 py-2.5 cursor-pointer"
            >
              <div className="flex size-7 items-center justify-center rounded-md bg-muted text-foreground">
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">Toggle color theme</span>
                <span className="text-[11px] text-muted-foreground">
                  Switch between dark carbon and light theme
                </span>
              </div>
              <CommandShortcut>Theme</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator className="my-1.5" />

          {/* Platform Navigation */}
          <CommandGroup heading="Platform">
            <CommandItem
              onSelect={() => runCommand(() => router.push('/'))}
              className="gap-3 py-2 cursor-pointer"
            >
              <LayoutDashboard className="size-4 text-muted-foreground" />
              <span>Dashboard Overview</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push('/projects'))}
              className="gap-3 py-2 cursor-pointer"
            >
              <Folder className="size-4 text-muted-foreground" />
              <span>Projects & Services</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator className="my-1.5" />

          {/* Infrastructure Navigation */}
          <CommandGroup heading="Infrastructure">
            <CommandItem
              onSelect={() => runCommand(() => router.push('/nodes'))}
              className="gap-3 py-2 cursor-pointer"
            >
              <HardDrive className="size-4 text-muted-foreground" />
              <span>Cluster Nodes</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push('/monitoring'))}
              className="gap-3 py-2 cursor-pointer"
            >
              <Activity className="size-4 text-muted-foreground" />
              <span>Cluster Telemetry & Monitoring</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator className="my-1.5" />

          {/* Management Navigation */}
          <CommandGroup heading="Management">
            <CommandItem
              onSelect={() => runCommand(() => router.push('/audit-logs'))}
              className="gap-3 py-2 cursor-pointer"
            >
              <FileText className="size-4 text-muted-foreground" />
              <span>Audit Logs</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push('/settings'))}
              className="gap-3 py-2 cursor-pointer"
            >
              <Settings className="size-4 text-muted-foreground" />
              <span>Cluster Settings</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push('/profile'))}
              className="gap-3 py-2 cursor-pointer"
            >
              <User className="size-4 text-muted-foreground" />
              <span>User Profile & Security</span>
            </CommandItem>
          </CommandGroup>

          {/* Projects */}
          {projects.length > 0 && (
            <>
              <CommandSeparator className="my-1.5" />
              <CommandGroup heading="Projects">
                {projects.map((proj) => (
                  <CommandItem
                    key={proj.id}
                    onSelect={() => runCommand(() => router.push(`/projects/${proj.id}`))}
                    className="gap-3 py-2 cursor-pointer"
                  >
                    <Folder className="size-4 text-primary" />
                    <span className="font-medium text-foreground">{proj.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">({proj.slug})</span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {proj.servicesCount} services
                      </span>
                      <span className={cn('size-2 rounded-full', getStatusColor(proj.status))} />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Services */}
          {services.length > 0 && (
            <>
              <CommandSeparator className="my-1.5" />
              <CommandGroup heading="Services">
                {services.map((srv) => (
                  <CommandItem
                    key={srv.id}
                    onSelect={() =>
                      runCommand(() => router.push(`/projects/${srv.projectId}/services/${srv.id}`))
                    }
                    className="gap-3 py-2 cursor-pointer"
                  >
                    <Server className="size-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{srv.name}</span>
                    <span className="rounded-xs bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground uppercase">
                      {srv.type}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {srv.nodeName}
                      </span>
                      <span className={cn('size-2 rounded-full', getStatusColor(srv.status))} />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Nodes */}
          {nodes.length > 0 && (
            <>
              <CommandSeparator className="my-1.5" />
              <CommandGroup heading="Nodes">
                {nodes.map((node) => (
                  <CommandItem
                    key={node.id}
                    onSelect={() => runCommand(() => router.push(`/nodes/${node.id}`))}
                    className="gap-3 py-2 cursor-pointer"
                  >
                    <HardDrive className="size-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{node.name}</span>
                    <span className="text-xs font-mono text-muted-foreground">{node.ipAddress}</span>
                    <span className="rounded-xs bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">
                      {node.role}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className={cn('size-2 rounded-full', getStatusColor(node.status))} />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </BaseCommandDialog>
  );
}
