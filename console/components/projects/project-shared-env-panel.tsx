'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Save, FileCode, Table as TableIcon, KeyRound, Loader2, Info, Plus, Trash2, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { EnvVar } from '@/lib/types';
import { parseDotEnv, formatDotEnv } from '@/lib/utils/env-parser';
import { useProjectEnvVars, useUpdateProjectEnvVars } from '@/lib/queries/use-projects';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ProjectSharedEnvPanelProps {
  projectId: string;
}

export function ProjectSharedEnvPanel({ projectId }: ProjectSharedEnvPanelProps) {
  const { data: remoteVars, isLoading } = useProjectEnvVars(projectId);
  const [mode, setMode] = useState<'table' | 'raw'>('table');
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [rawText, setRawText] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const lastSyncedRef = useRef<EnvVar[] | null>(null);

  useEffect(() => {
    if (!isDirty && remoteVars && remoteVars !== lastSyncedRef.current) {
      lastSyncedRef.current = remoteVars;
      setEnvVars(remoteVars);
      setRawText(formatDotEnv(remoteVars));
    }
  }, [remoteVars, isDirty]);

  const saveMutation = useUpdateProjectEnvVars(projectId, {
    onSuccess: (updated) => {
      setIsDirty(false);
      lastSyncedRef.current = updated;
      setEnvVars(updated);
      setRawText(formatDotEnv(updated));
    },
  });

  const handleAddRow = () => {
    const newVar: EnvVar = {
      id: `env-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      key: '',
      value: '',
      isSecret: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [...envVars, newVar];
    setEnvVars(next);
    setRawText(formatDotEnv(next));
    setIsDirty(true);
  };

  const handleUpdateRow = (index: number, field: keyof EnvVar, value: any) => {
    const next = [...envVars];
    next[index] = { ...next[index], [field]: value };
    setEnvVars(next);
    setRawText(formatDotEnv(next));
    setIsDirty(true);
  };

  const handleDeleteRow = (index: number) => {
    const next = envVars.filter((_, i) => i !== index);
    setEnvVars(next);
    setRawText(formatDotEnv(next));
    setIsDirty(true);
  };

  const handleRawChange = (newRaw: string) => {
    setRawText(newRaw);
    const parsed = parseDotEnv(newRaw);
    const mapped: EnvVar[] = parsed.map((p, idx) => ({
      id: `penv-${idx}-${p.key}`,
      key: p.key || '',
      value: p.value || '',
      isSecret: p.isSecret || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    setEnvVars(mapped);
    setIsDirty(true);
  };

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    toast.success(`Copied ${keyName} to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = () => {
    // Filter empty keys
    const valid = envVars.filter((v) => v.key.trim().length > 0);
    saveMutation.mutate(valid);
  };

  return (
    <Card className="border-border bg-card p-6">
      <CardHeader className="px-0 pt-0 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary border border-primary/20">
              <KeyRound className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                Shared Environment Variables
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25 font-normal">
                  Project Scope
                </span>
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Variables configured here are automatically inherited by all child services in this project.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Table / Raw Toggle */}
            <div className="inline-flex h-8 items-center rounded-md border border-border bg-muted/40 p-0.5 select-none">
              <button
                type="button"
                onClick={() => setMode('table')}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-all',
                  mode === 'table' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <TableIcon className="size-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('raw')}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-all',
                  mode === 'raw' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <FileCode className="size-3.5" />
                <span>Raw .env</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSecrets(!showSecrets)}
              className="h-8 text-xs gap-1.5 border-border"
            >
              {showSecrets ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              <span>{showSecrets ? 'Hide Secrets' : 'Reveal'}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0 py-2 space-y-4">
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-border/60 text-xs text-muted-foreground">
          <Info className="size-4 shrink-0 text-primary" />
          <span>
            Services within this project will merge these values at deployment time. If a service defines a variable with the same key, the service-level variable takes precedence.
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" />
            Loading shared variables...
          </div>
        ) : mode === 'table' ? (
          <div className="space-y-3">
            {envVars.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-lg">
                <KeyRound className="size-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-foreground">No shared environment variables</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Add shared database connection strings, JWT secrets, or cloud credentials.
                </p>
                <Button size="sm" onClick={handleAddRow} className="gap-1.5">
                  <Plus className="size-3.5" />
                  <span>Add First Variable</span>
                </Button>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden bg-background">
                <div className="grid grid-cols-12 gap-3 p-3 bg-muted/40 border-b border-border text-xs font-medium text-muted-foreground">
                  <div className="col-span-4">KEY</div>
                  <div className="col-span-5">VALUE</div>
                  <div className="col-span-2 text-center">SECRET</div>
                  <div className="col-span-1 text-right">ACTIONS</div>
                </div>

                <div className="divide-y divide-border/60">
                  {envVars.map((v, idx) => (
                    <div key={v.id || idx} className="grid grid-cols-12 gap-3 p-2.5 items-center hover:bg-muted/10 transition-colors">
                      <div className="col-span-4">
                        <Input
                          placeholder="e.g. DATABASE_URL"
                          value={v.key}
                          onChange={(e) => handleUpdateRow(idx, 'key', e.target.value.toUpperCase())}
                          className="h-8 font-mono text-xs border-border/80"
                        />
                      </div>
                      <div className="col-span-5 relative">
                        <Input
                          type={v.isSecret && !showSecrets ? 'password' : 'text'}
                          placeholder="value..."
                          value={v.value}
                          onChange={(e) => handleUpdateRow(idx, 'value', e.target.value)}
                          className="h-8 font-mono text-xs border-border/80 pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopy(v.value, v.key)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          title="Copy value"
                        >
                          {copiedKey === v.key ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                        </button>
                      </div>
                      <div className="col-span-2 flex justify-center items-center">
                        <Switch
                          checked={v.isSecret}
                          onCheckedChange={(checked) => handleUpdateRow(idx, 'isSecret', checked)}
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRow(idx)}
                          className="size-7 text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 border-t border-border bg-muted/10">
                  <Button variant="ghost" size="sm" onClick={handleAddRow} className="text-xs gap-1.5 h-7">
                    <Plus className="size-3.5" />
                    <span>Add Variable</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              rows={10}
              value={rawText}
              onChange={(e) => handleRawChange(e.target.value)}
              placeholder="KEY=value&#10;# Comments are supported&#10;SECRET_KEY=secret_value"
              className="w-full font-mono text-xs p-3 rounded-lg border border-border bg-background focus:outline-hidden focus:ring-1 focus:ring-primary leading-relaxed resize-y"
            />
            <p className="text-xs text-muted-foreground">
              Format: Standard .env file syntax (KEY=value). Lines starting with # are comments.
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="px-0 pt-4 pb-0 flex justify-between items-center border-t border-border mt-4">
        <span className="text-xs text-muted-foreground">
          {envVars.filter((v) => v.key.trim().length > 0).length} shared variables configured
        </span>
        <Button
          onClick={handleSave}
          disabled={!isDirty || saveMutation.isPending}
          className="gap-2"
        >
          {saveMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          <span>Save Changes</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
