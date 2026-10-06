'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import {
  Search,
  User as UserIcon,
  Settings,
  LogOut,
  Sun,
  Moon,
  ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getCurrentUser } from '@/lib/api/settings';
import { getProjects } from '@/lib/api/projects';
import { getServices, getServiceById } from '@/lib/api/services';
import { getNodes } from '@/lib/api/nodes';
import { openCommandPalette } from '@/hooks/use-command-palette';
import { NotificationPopover } from '@/components/notifications/notification-popover';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [serviceSwitcherOpen, setServiceSwitcherOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? (theme === 'system' ? resolvedTheme : theme) : 'dark';

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const { data: nodes = [] } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
  });

  // Breadcrumbs builder
  const rawSegments = pathname.split('/').filter(Boolean);

  // Detect service route:
  // 1. /projects/[projectId]/services/[serviceId]
  // 2. /services/[serviceId]
  const isNestedServicePage =
    rawSegments[0] === 'projects' &&
    rawSegments.length >= 4 &&
    rawSegments[2] === 'services';

  const isDirectServicePage =
    rawSegments[0] === 'services' && rawSegments.length >= 2;

  const isProjectServicePage = isNestedServicePage || isDirectServicePage;

  const urlProjectId = isNestedServicePage
    ? rawSegments[1]
    : rawSegments[0] === 'projects' && rawSegments.length >= 2
    ? rawSegments[1]
    : null;

  const urlServiceId = isNestedServicePage
    ? rawSegments[3]
    : isDirectServicePage
    ? rawSegments[1]
    : null;

  // Fetch active service details if on a service page
  const { data: activeService } = useQuery({
    queryKey: ['service', urlServiceId],
    queryFn: () => getServiceById(urlServiceId!),
    enabled: !!urlServiceId,
  });

  const effectiveProjectId = urlProjectId || activeService?.projectId || null;
  const effectiveServiceId = urlServiceId;

  // Fetch project services for the switcher
  const { data: projectServices = [] } = useQuery({
    queryKey: ['services', effectiveProjectId],
    queryFn: () => getServices(effectiveProjectId!),
    enabled: !!effectiveProjectId,
  });

  const currentProject = projects.find(
    (p) => p.id === effectiveProjectId || p.slug === effectiveProjectId
  );

  const currentService =
    activeService ||
    projectServices.find(
      (s) => s.id === effectiveServiceId || s.slug === effectiveServiceId
    );

  const projectName =
    currentProject?.name ||
    (effectiveProjectId
      ? effectiveProjectId.charAt(0).toUpperCase() + effectiveProjectId.slice(1).replace(/-/g, ' ')
      : 'Project');

  const serviceName =
    currentService?.name ||
    (effectiveServiceId
      ? effectiveServiceId.charAt(0).toUpperCase() + effectiveServiceId.slice(1).replace(/-/g, ' ')
      : 'Service');

  return (
    <header className="bg-sidebar sticky top-0 z-30 flex h-14 w-full items-center justify-between px-4 lg:px-8 border-b border-sidebar-border transition-colors shrink-0">
      {/* Left: Sidebar Toggle + Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
        {/* Sidebar Toggle Button with Shortcut Tooltip */}
        <Tooltip>
          <TooltipTrigger
            render={
              <SidebarTrigger className="-ml-1 size-8 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0" />
            }
          />
          <TooltipContent side="bottom" align="start">
            <span className="flex items-center gap-1.5">
              <span>Toggle sidebar</span>
              <kbd className="rounded border border-border/70 bg-background/80 px-1 py-0.2 font-mono text-[10px] text-muted-foreground">
                ⌘B
              </kbd>
            </span>
          </TooltipContent>
        </Tooltip>

        <Separator
          orientation="vertical"
          className="h-4 w-px data-vertical:h-4 data-vertical:self-center shrink-0 bg-border hidden sm:block"
        />

        {/* Dynamic Breadcrumbs */}
        <Breadcrumb className="hidden sm:flex min-w-0">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="text-xs sm:text-sm font-medium">
                Tako
              </BreadcrumbLink>
            </BreadcrumbItem>

            {/* Case A: /projects/[projectId]/services/[serviceId] -> Tako > Projects > Proj 1 > Srv 1 (dropdown) */}
            {isProjectServicePage && effectiveProjectId && effectiveServiceId ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/projects" className="text-xs sm:text-sm font-medium">
                    Projects
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href={`/projects/${effectiveProjectId}`}
                    className="text-xs sm:text-sm font-medium truncate max-w-[140px] lg:max-w-[180px]"
                    title={projectName}
                  >
                    {projectName}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <Popover open={serviceSwitcherOpen} onOpenChange={setServiceSwitcherOpen}>
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          className={cn(
                            'flex items-center gap-1.5 px-2 py-1 -my-1 rounded-md text-xs sm:text-sm font-semibold transition-colors outline-none cursor-pointer group',
                            serviceSwitcherOpen
                              ? 'bg-muted text-foreground ring-1 ring-border'
                              : 'text-foreground hover:bg-muted/70 hover:text-primary'
                          )}
                          title="Switch service"
                        >
                          <span className="truncate max-w-[130px] lg:max-w-[200px]">
                            {serviceName}
                          </span>
                          <ChevronsUpDown className="size-3 text-muted-foreground group-hover:text-primary shrink-0 transition-transform" />
                        </button>
                      }
                    />
                    <PopoverContent align="start" className="w-72 p-0 shadow-lg border-border/80">
                      <Command>
                        <CommandInput
                          placeholder="Search service..."
                          className="h-8 text-xs font-sans"
                          autoFocus
                        />
                        <CommandList className="max-h-60 overflow-y-auto p-1">
                          <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                            No service found.
                          </CommandEmpty>
                          <CommandGroup heading={`Services in ${projectName}`}>
                            {projectServices.map((srv) => {
                              const isSelected =
                                srv.id === effectiveServiceId || srv.slug === effectiveServiceId;
                              return (
                                <CommandItem
                                  key={srv.id}
                                  value={`${srv.name} ${srv.slug} ${srv.type}`}
                                  data-checked={isSelected ? 'true' : undefined}
                                  onSelect={() => {
                                    setServiceSwitcherOpen(false);
                                    router.push(`/projects/${effectiveProjectId}/services/${srv.id}`);
                                  }}
                                  className={cn(
                                    'flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs rounded-md cursor-pointer',
                                    isSelected && 'bg-primary/10 text-primary font-medium'
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={cn(
                                        'size-1.5 rounded-full shrink-0',
                                        srv.status === 'healthy'
                                          ? 'bg-emerald-500'
                                          : srv.status === 'deploying' || srv.status === 'queued'
                                          ? 'bg-blue-500 animate-pulse'
                                          : srv.status === 'unhealthy'
                                          ? 'bg-red-500'
                                          : srv.status === 'degraded'
                                          ? 'bg-amber-500'
                                          : 'bg-neutral-400'
                                      )}
                                    />
                                    <div className="flex flex-col min-w-0 text-left">
                                      <span className="truncate font-medium">{srv.name}</span>
                                      <span className="text-[10px] text-muted-foreground font-mono uppercase">
                                        {srv.type}
                                      </span>
                                    </div>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </BreadcrumbItem>
              </>
            ) : rawSegments[0] === 'projects' && rawSegments.length === 2 && effectiveProjectId ? (
              /* Case B: /projects/[projectId] -> Tako > Projects > Proj 1 */
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/projects" className="text-xs sm:text-sm font-medium">
                    Projects
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs sm:text-sm font-semibold truncate max-w-[180px]">
                    {projectName}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              /* Case C: Generic paths (e.g. /projects, /nodes, /nodes/[id], /monitoring, /settings) */
              rawSegments
                .filter((s) => s !== 'services')
                .map((seg, idx, arr) => {
                  const isLast = idx === arr.length - 1;
                  const href = '/' + rawSegments.slice(0, rawSegments.indexOf(seg) + 1).join('/');

                  let displayTitle =
                    seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');

                  if (rawSegments[0] === 'nodes' && idx === 1) {
                    const nodeMatch = nodes.find(
                      (n) => n.id === seg || n.name.toLowerCase() === seg
                    );
                    if (nodeMatch) displayTitle = nodeMatch.name;
                  }

                  if (rawSegments[0] === 'projects' && idx === 1) {
                    const projMatch = projects.find(
                      (p) => p.id === seg || p.slug === seg
                    );
                    if (projMatch) displayTitle = projMatch.name;
                  }

                  return (
                    <React.Fragment key={href}>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage className="text-xs sm:text-sm font-semibold capitalize truncate max-w-[180px]">
                            {displayTitle}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink
                            href={href}
                            className="text-xs sm:text-sm font-medium capitalize"
                          >
                            {displayTitle}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  );
                })
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right Controls: Search, Notifications, User Avatar */}
      <div className="flex items-center gap-2">
        {/* Command Palette Trigger Button (⌘K) */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 px-2.5 text-xs text-muted-foreground hover:text-foreground font-normal border-border/60 bg-muted/30"
          onClick={() => openCommandPalette()}
        >
          <Search className="size-3.5" />
          <span className="hidden md:inline">Search console...</span>
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border/80 bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-80">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>

        {/* Notifications Dropdown */}
        <NotificationPopover />

        {/* User Profile Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-transform active:scale-95 cursor-pointer"
            aria-label="User account menu"
          >
            <Avatar className="size-8 ring-1 ring-border hover:ring-primary/50 transition-all">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {user?.name
                  ? user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                  : 'SM'}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 p-1.5 shadow-lg">
            <DropdownMenuLabel className="px-2.5 py-2">
              <div className="flex flex-col space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{user?.name || 'Supian M'}</span>
                  <span className="inline-flex items-center rounded-xs bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary capitalize">
                    {user?.role || 'owner'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground truncate">{user?.email || 'supianidz@gmail.com'}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLinkItem
                closeOnClick
                render={<Link href="/profile" className="flex items-center gap-2.5 w-full cursor-pointer" />}
              >
                <UserIcon className="size-4 text-muted-foreground" />
                <span>Profile</span>
              </DropdownMenuLinkItem>
              <DropdownMenuLinkItem
                closeOnClick
                render={<Link href="/settings" className="flex items-center gap-2.5 w-full cursor-pointer" />}
              >
                <Settings className="size-4 text-muted-foreground" />
                <span>Account Settings</span>
              </DropdownMenuLinkItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* Theme Grid Toggle (Sun / Moon) */}
            <div className="px-2.5 py-2">
              <span className="text-[11px] font-medium text-muted-foreground block mb-1.5">
                Theme
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/70 p-1 border border-border/40">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-md py-1.5 px-2 text-xs font-medium transition-all cursor-pointer',
                    activeTheme === 'light'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <Sun className="size-3.5" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-md py-1.5 px-2 text-xs font-medium transition-all cursor-pointer',
                    activeTheme === 'dark'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <Moon className="size-3.5" />
                  <span>Dark</span>
                </button>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="flex items-center gap-2.5 cursor-pointer text-status-danger focus:text-status-danger"
              onClick={() => {
                alert('Sign out functionality would connect to auth provider');
              }}
            >
              <LogOut className="size-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
