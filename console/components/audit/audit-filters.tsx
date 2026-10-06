'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search,
  X,
  Users,
  RotateCcw,
  Layers,
  ShieldCheck,
  FolderGit2,
  Server,
  HardDrive,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type AuditCategory = 'all' | 'auth' | 'project' | 'service' | 'node' | 'settings';

export interface AuditActorOption {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

interface AuditFiltersProps {
  category: AuditCategory;
  onCategoryChange: (cat: AuditCategory) => void;
  search: string;
  onSearchChange: (search: string) => void;
  selectedActor: string;
  onActorChange: (actor: string) => void;
  actors: AuditActorOption[];
  counts?: Record<AuditCategory, number>;
  onReset?: () => void;
}

const CATEGORIES: { id: AuditCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'All Events', icon: Layers },
  { id: 'auth', label: 'Auth & Security', icon: ShieldCheck },
  { id: 'project', label: 'Projects', icon: FolderGit2 },
  { id: 'service', label: 'Services', icon: Server },
  { id: 'node', label: 'Nodes', icon: HardDrive },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
];

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AuditFilters({
  category,
  onCategoryChange,
  search,
  onSearchChange,
  selectedActor,
  onActorChange,
  actors,
  counts,
  onReset,
}: AuditFiltersProps) {
  const selectedActorObj = actors.find((a) => a.name === selectedActor);
  const hasActiveFilters = search.trim() !== '' || selectedActor !== 'all' || category !== 'all';

  return (
    <div className="space-y-4">
      {/* Category Tabs (Base Vega specification via @base-ui/react/tabs) */}
      <div className="overflow-x-auto pb-1 scrollbar-none">
        <Tabs
          value={category}
          onValueChange={(val) => onCategoryChange(val as AuditCategory)}
          className="w-full"
        >
          <TabsList className="h-9 p-1 bg-muted/60 dark:bg-muted/30 border border-border rounded-lg gap-1 min-w-max justify-start">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const count = counts?.[cat.id];
              const isSelected = category === cat.id;

              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className={cn( 'h-7 px-3 text-xs font-medium rounded-md gap-1.5 transition-all select-none', 'active:not-aria-[haspopup]:translate-y-px', 'data-active:bg-background data-active:text-foreground data-active:border data-active:border-border', 'dark:data-active:bg-card dark:data-active:text-foreground dark:data-active:border-border' )}
                >
                  <Icon
                    className={cn( 'size-3.5 shrink-0 transition-opacity', isSelected ? 'opacity-100 text-primary dark:text-[#98A4F7]' : 'opacity-60 text-muted-foreground' )}
                  />
                  <span>{cat.label}</span>
                  {typeof count === 'number' && (
                    <span
                      className={cn( 'ml-1 text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-full transition-colors', isSelected ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-[#98A4F7]' : 'bg-muted-foreground/15 text-muted-foreground' )}
                    >
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Search Input & Base Vega Clean Actor Select */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input with clear button */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search action, target resource, or actor..."
            className="pl-9 pr-8 text-xs sm:text-sm h-9 bg-card border-border rounded-md placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-sm transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filter controls row */}
        <div className="flex items-center gap-2">
          {/* Base Vega Clean Actor Select (No bleeding borders) */}
          <div className="relative w-full sm:w-60">
            <Select
              value={selectedActor}
              onValueChange={(val) => onActorChange(val ? String(val) : 'all')}
            >
              <SelectTrigger className="h-9 w-full bg-card border-border text-xs sm:text-sm cursor-pointer hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2 truncate">
                  {selectedActor === 'all' ? (
                    <>
                      <div className="size-5 rounded-full bg-muted/80 border border-border flex items-center justify-center shrink-0 text-muted-foreground">
                        <Users className="size-3" />
                      </div>
                      <span className="truncate text-muted-foreground font-normal">All Actors</span>
                    </>
                  ) : (
                    <>
                      <Avatar className="size-5 shrink-0 border border-border">
                        <AvatarImage src={selectedActorObj?.avatarUrl} alt={selectedActor} />
                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                          {getInitials(selectedActor)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-foreground font-semibold">
                        {selectedActor}
                      </span>
                    </>
                  )}
                </div>
              </SelectTrigger>

              <SelectContent
                align="end"
                className="w-72 bg-popover border border-border p-1 rounded-lg"
              >
                {/* All Actors option */}
                <SelectItem value="all" className="py-2 rounded-md">
                  <div className="flex items-center gap-2.5">
                    <div className="size-7 rounded-full bg-muted/80 border border-border flex items-center justify-center shrink-0 text-muted-foreground">
                      <Users className="size-3.5" />
                    </div>
                    <div className="truncate text-left">
                      <div className="font-semibold text-xs text-foreground">All Actors</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        Events from all operators
                      </div>
                    </div>
                  </div>
                </SelectItem>

                {/* Individual Actors */}
                {actors.map((actor) => (
                  <SelectItem key={actor.id} value={actor.name} className="py-2 rounded-md">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-7 shrink-0 border border-border">
                        <AvatarImage src={actor.avatarUrl} alt={actor.name} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                          {getInitials(actor.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="truncate text-left min-w-0">
                        <div className="font-semibold text-xs text-foreground truncate">
                          {actor.name}
                        </div>
                        {actor.email && (
                          <div className="text-[11px] text-muted-foreground truncate font-mono">
                            {actor.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Clear Actor button when filter is active */}
          {selectedActor !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onActorChange('all')}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground active:not-aria-[haspopup]:translate-y-px"
              title="Reset actor filter to All"
            >
              <X className="size-3.5" />
            </Button>
          )}

          {/* Reset All Filters button */}
          {hasActiveFilters && onReset && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 active:not-aria-[haspopup]:translate-y-px border-border bg-card shrink-0"
              title="Reset all active filters"
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
