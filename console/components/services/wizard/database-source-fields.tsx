import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Database, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DATABASE_PRESETS = [
  {
    type: 'postgresql' as const,
    name: 'PostgreSQL',
    port: 5432,
    defaultTag: 'latest',
    tags: ['latest', '16-alpine', '15-alpine'],
    desc: 'Relational database with JSON support & ACID transactions.',
  },
  {
    type: 'mysql' as const,
    name: 'MySQL',
    port: 3306,
    defaultTag: 'latest',
    tags: ['latest', '8.0', '8.4'],
    desc: 'Fast, widely adopted relational SQL database.',
  },
  {
    type: 'redis' as const,
    name: 'Redis',
    port: 6379,
    defaultTag: 'latest',
    tags: ['latest', '7-alpine', '6-alpine'],
    desc: 'Ultra-fast in-memory key-value cache and message broker.',
  },
  {
    type: 'mongodb' as const,
    name: 'MongoDB',
    port: 27017,
    defaultTag: 'latest',
    tags: ['latest', '7.0', '6.0'],
    desc: 'Document-oriented NoSQL database with flexible JSON documents.',
  },
];

export type DatabasePresetType = 'postgresql' | 'mysql' | 'redis' | 'mongodb';

export interface DatabaseSourceFieldsProps {
  databaseType: DatabasePresetType;
  databaseVersion: string;
  onSelectDatabaseType: (type: DatabasePresetType) => void;
  onSelectDatabaseVersion: (version: string) => void;
}

export function DatabaseSourceFields({
  databaseType,
  databaseVersion,
  onSelectDatabaseType,
  onSelectDatabaseVersion,
}: DatabaseSourceFieldsProps) {
  const currentPreset = DATABASE_PRESETS.find((p) => p.type === databaseType);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Database className="size-3.5 text-foreground" />
          <span>Database Engine &amp; Tag</span>
          <span className="text-status-danger">*</span>
        </Label>
        <Badge variant="secondary" className="text-[11px] font-mono">
          Persistent Docker Volume
        </Badge>
      </div>

      {/* 4 DB Engines Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {DATABASE_PRESETS.map((p) => {
          const isSelected = databaseType === p.type;
          return (
            <button
              key={p.type}
              type="button"
              onClick={() => onSelectDatabaseType(p.type)}
              className={cn(
                'flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer outline-none active:not-aria-[haspopup]:translate-y-px',
                isSelected
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/40 text-foreground'
                  : 'border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-foreground">{p.name}</span>
                {isSelected && <Check className="size-3 text-primary" />}
              </div>
              <span className="text-[10px] font-mono text-muted-foreground mt-1">Port {p.port}</span>
              <span className="text-[10px] text-muted-foreground/80 mt-1 line-clamp-1">{p.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Image Tag / Version Input Field */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="db-image-tag" className="text-xs font-semibold text-foreground">
            Image Tag / Version <span className="text-status-danger">*</span>
          </Label>
          <span className="text-[11px] text-muted-foreground font-mono">
            Target Image: {databaseType === 'mongodb' ? 'mongo' : databaseType}:{databaseVersion || 'latest'}
          </span>
        </div>
        <Input
          id="db-image-tag"
          value={databaseVersion}
          onChange={(e) => onSelectDatabaseVersion(e.target.value)}
          placeholder="latest"
          className="h-9 text-xs sm:text-sm font-mono"
        />
        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
          <span className="text-[11px] text-muted-foreground">Version Presets:</span>
          {(currentPreset?.tags || ['latest']).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onSelectDatabaseVersion(tag)}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer font-mono active:not-aria-[haspopup]:translate-y-px',
                databaseVersion === tag
                  ? 'bg-primary text-primary-foreground border-primary font-semibold'
                  : 'bg-muted/50 text-muted-foreground border-border hover:text-foreground'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
