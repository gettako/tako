'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Search, Filter } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';

export type AuditCategory = 'all' | 'auth' | 'project' | 'service' | 'node' | 'settings';

interface AuditFiltersProps {
  category: AuditCategory;
  onCategoryChange: (cat: AuditCategory) => void;
  search: string;
  onSearchChange: (search: string) => void;
  selectedActor: string;
  onActorChange: (actor: string) => void;
  actors: { id: string; name: string }[];
}

const CATEGORIES: { id: AuditCategory; label: string }[] = [
  { id: 'all', label: 'All Events' },
  { id: 'auth', label: 'Auth & Security' },
  { id: 'project', label: 'Projects' },
  { id: 'service', label: 'Services' },
  { id: 'node', label: 'Nodes' },
  { id: 'settings', label: 'Settings' },
];

export function AuditFilters({
  category,
  onCategoryChange,
  search,
  onSearchChange,
  selectedActor,
  onActorChange,
  actors,
}: AuditFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Category Tabs (AC-1) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={cn(
                'h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all active:not-aria-[haspopup]:translate-y-px',
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-muted/40 border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/70'
              )}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Search Input & Actor Dropdown Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search action, target resource, or actor..."
            className="pl-8 text-xs h-9 bg-card border-border/70 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground shrink-0" />
          <SearchableSelect
            value={selectedActor}
            onValueChange={onActorChange}
            options={[
              { value: 'all', label: 'All Actors' },
              ...actors.map((actor) => ({ value: actor.name, label: actor.name })),
            ]}
            size="sm"
            className="h-9 w-48 text-xs bg-card border-border/70 shadow-2xs"
          />
        </div>
      </div>
    </div>
  );
}
