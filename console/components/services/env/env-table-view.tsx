'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, Plus, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EnvVar } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface EnvTableViewProps {
  envVars: EnvVar[];
  onChange: (envVars: EnvVar[]) => void;
}

export function EnvTableView({ envVars, onChange }: EnvTableViewProps) {
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

  const toggleReveal = (id: string) => {
    setRevealedSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUpdate = (id: string, field: keyof EnvVar, value: any) => {
    const updated = envVars.map((v) => (v.id === id ? { ...v, [field]: value } : v));
    onChange(updated);
  };

  const handleDelete = (id: string) => {
    onChange(envVars.filter((v) => v.id !== id));
  };

  const handleAddRow = () => {
    const newVar: EnvVar = {
      id: `env-${Date.now()}`,
      key: '',
      value: '',
      isSecret: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onChange([...envVars, newVar]);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[280px]">Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-[110px]">Type</TableHead>
              <TableHead className="w-[80px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {envVars.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                  No environment variables configured yet. Click "Add Variable" below.
                </TableCell>
              </TableRow>
            ) : (
              envVars.map((item) => {
                const isRevealed = revealedSecrets[item.id] || !item.isSecret;

                return (
                  <TableRow key={item.id} className="h-14">
                    {/* Key Input */}
                    <TableCell>
                      <Input
                        value={item.key}
                        placeholder="KEY_NAME"
                        onChange={(e) => handleUpdate(item.id, 'key', e.target.value.toUpperCase())}
                        className="font-mono text-xs uppercase h-8"
                      />
                    </TableCell>

                    {/* Value Input + Secret Mask */}
                    <TableCell>
                      <div className="relative flex items-center">
                        <Input
                          type={isRevealed ? 'text' : 'password'}
                          value={item.value}
                          placeholder="value"
                          onChange={(e) => handleUpdate(item.id, 'value', e.target.value)}
                          className="font-mono text-xs pr-8 h-8"
                        />
                        {item.isSecret && (
                          <button
                            type="button"
                            onClick={() => toggleReveal(item.id)}
                            className="absolute right-2 text-muted-foreground hover:text-foreground p-1 transition-colors"
                            title={isRevealed ? 'Hide secret' : 'Reveal secret'}
                          >
                            {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </button>
                        )}
                      </div>
                    </TableCell>

                    {/* Secret Toggle Badge */}
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleUpdate(item.id, 'isSecret', !item.isSecret)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors select-none',
                          item.isSecret
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                        title="Toggle secret masking"
                      >
                        <Lock className="size-3" />
                        <span>{item.isSecret ? 'Secret' : 'Plain'}</span>
                      </button>
                    </TableCell>

                    {/* Delete action */}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Delete variable"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleAddRow}
        className="gap-1.5 text-xs h-8"
      >
        <Plus className="size-3.5" />
        <span>Add Variable</span>
      </Button>
    </div>
  );
}
