'use client';

import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'grid' | 'table';

export interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ mode, onChange, className }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="View layout switch"
      className={cn( 'inline-flex h-8 items-center rounded-md border border-border bg-muted/40 p-0.5 select-none', className )}
    >
      <button
        type="button"
        onClick={() => onChange('grid')}
        aria-pressed={mode === 'grid'}
        aria-label="Grid view"
        className={cn( 'inline-flex h-7 items-center justify-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-all', mode === 'grid' ? 'bg-background text-foreground border border-border font-medium' : 'text-muted-foreground hover:text-foreground border border-transparent' )}
      >
        <LayoutGrid className="size-3.5" />
        <span className="hidden sm:inline">Grid</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('table')}
        aria-pressed={mode === 'table'}
        aria-label="Table list view"
        className={cn( 'inline-flex h-7 items-center justify-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-all', mode === 'table' ? 'bg-background text-foreground border border-border font-medium' : 'text-muted-foreground hover:text-foreground border border-transparent' )}
      >
        <List className="size-3.5" />
        <span className="hidden sm:inline">Table</span>
      </button>
    </div>
  );
}
