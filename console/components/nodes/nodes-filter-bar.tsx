'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { NodeStatus } from '@/lib/types';

export type StatusFilter = 'all' | NodeStatus;

export interface NodesFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedStatus: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  totalCount: number;
  filteredCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  statusCounts: {
    all: number;
    online: number;
    degraded: number;
    offline: number;
  };
}

export function NodesFilterBar({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  totalCount,
  filteredCount,
  viewMode,
  onViewModeChange,
  statusCounts,
}: NodesFilterBarProps) {
  const hasActiveFilters = searchQuery.trim().length > 0 || selectedStatus !== 'all';

  const resetFilters = () => {
    onSearchChange('');
    onStatusChange('all');
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Search Input & Status Selector */}
      <div className="flex flex-1 flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search hostname, IP, OS..."
            className="pl-9 pr-8 text-sm h-9 bg-card border-border/80 focus-visible:ring-3 focus-visible:ring-ring/50 outline-hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto p-0.5 rounded-lg border border-border/60 bg-muted/20">
          {(
            [
              { id: 'all', label: 'All', count: statusCounts.all },
              { id: 'online', label: 'Online', count: statusCounts.online },
              { id: 'degraded', label: 'Degraded', count: statusCounts.degraded },
              { id: 'offline', label: 'Offline', count: statusCounts.offline },
            ] as const
          ).map((item) => {
            const isSelected = selectedStatus === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onStatusChange(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-medium transition-all active:not-aria-[haspopup]:translate-y-px ${
                  isSelected
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`text-[10px] font-mono px-1 rounded-sm ${
                    isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground/80'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1 active:not-aria-[haspopup]:translate-y-px"
          >
            <X className="size-3.5" />
            <span>Reset</span>
          </Button>
        )}
      </div>

      {/* Right side: Count Badge & View Mode Switcher */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        <Badge variant="outline" className="font-mono text-xs text-muted-foreground h-9 px-3">
          Showing {filteredCount} of {totalCount} {totalCount === 1 ? 'node' : 'nodes'}
        </Badge>

        <ViewToggle mode={viewMode} onChange={onViewModeChange} />
      </div>
    </div>
  );
}
