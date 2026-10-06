'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { cn } from '@/lib/utils';

export type EnvironmentFilter = 'all' | 'production' | 'staging' | 'development';

export interface ProjectsFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedEnv: EnvironmentFilter;
  onEnvChange: (env: EnvironmentFilter) => void;
  environmentCounts: {
    all: number;
    production: number;
    staging: number;
    development: number;
  };
  totalCount: number;
  filteredCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const envOptions: { id: EnvironmentFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'production', label: 'Production' },
  { id: 'staging', label: 'Staging' },
  { id: 'development', label: 'Development' },
];

export function ProjectsFilterBar({
  searchQuery,
  onSearchChange,
  selectedEnv,
  onEnvChange,
  environmentCounts,
  totalCount,
  filteredCount,
  viewMode,
  onViewModeChange,
}: ProjectsFilterBarProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      {/* Left side: Search input + Environment tabs */}
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input (36px h-9) */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search projects by name, slug, tag..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm rounded-lg bg-card/60 border-border focus-visible:ring-3"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Environment Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {envOptions.map((opt) => {
            const count = environmentCounts[opt.id];
            const isSelected = selectedEnv === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onEnvChange(opt.id)}
                className={cn( 'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all active:not-aria-[haspopup]:translate-y-px whitespace-nowrap', isSelected ? 'border border-primary/25 bg-primary/10 text-primary font-semibold ' : 'border border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground' )}
              >
                <span>{opt.label}</span>
                <span
                  className={cn( 'rounded-full px-1.5 py-0.2 text-[10px] font-mono', isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground' )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right side: Count summary + Grid/Table ViewToggle */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        <span className="text-xs sm:text-sm text-muted-foreground">
          Showing <strong className="text-foreground font-semibold">{filteredCount}</strong> of{' '}
          {totalCount} projects
        </span>

        <ViewToggle mode={viewMode} onChange={onViewModeChange} />
      </div>
    </div>
  );
}
