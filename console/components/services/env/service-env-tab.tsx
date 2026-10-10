'use client';

import React, { useState, useEffect } from 'react';
import { Save, Check, FileCode, Table as TableIcon, KeyRound, Loader2, Info } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import { EnvTableView } from './env-table-view';
import { EnvRawView } from './env-raw-view';
import { EnvVar, Service } from '@/lib/types';
import { parseDotEnv, formatDotEnv } from '@/lib/utils/env-parser';
import { useUpdateServiceEnvVars } from '@/lib/queries';

export interface ServiceEnvTabProps {
  service: Service;
  onSaved?: (updatedVars: EnvVar[]) => void;
}

export function ServiceEnvTab({ service, onSaved }: ServiceEnvTabProps) {
  const [mode, setMode] = useState<'table' | 'raw'>('table');
  const [envVars, setEnvVars] = useState<EnvVar[]>(service.envVars || []);
  const [rawText, setRawText] = useState(() => formatDotEnv(service.envVars || []));
  const [isDirty, setIsDirty] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const saveMutation = useUpdateServiceEnvVars(service.id, {
    onSuccess: () => {
      setIsDirty(false);
      setSavedSuccess(true);
      onSaved?.(envVars);
      setTimeout(() => setSavedSuccess(false), 3000);
    },
  });

  useEffect(() => {
    if (!isDirty && service.envVars) {
      setEnvVars(service.envVars);
      setRawText(formatDotEnv(service.envVars));
    }
  }, [service.envVars, isDirty]);

  const handleTableChange = (newVars: EnvVar[]) => {
    setEnvVars(newVars);
    setRawText(formatDotEnv(newVars));
    setIsDirty(true);
  };

  const handleRawChange = (newRaw: string) => {
    setRawText(newRaw);
    const parsed = parseDotEnv(newRaw);
    const mapped: EnvVar[] = parsed.map((p, idx) => ({
      id: `env-${idx}-${p.key}`,
      key: p.key || '',
      value: p.value || '',
      isSecret: p.isSecret || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    setEnvVars(mapped);
    setIsDirty(true);
  };

  const handleSave = () => {
    saveMutation.mutate(envVars);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={KeyRound}
        title="Environment Variables"
        description="Variables injected into the container environment at runtime"
        action={
          <div className="flex items-center gap-3">
            {/* Mode Switcher */}
            <div className="inline-flex h-8 items-center rounded-md border border-border bg-muted/40 p-0.5 select-none">
              <button
                type="button"
                onClick={() => setMode('table')}
                className={`inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-all ${
                  mode === 'table'
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TableIcon className="size-3.5" />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('raw')}
                className={`inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-all ${
                  mode === 'raw'
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileCode className="size-3.5" />
                <span>Raw .env</span>
              </button>
            </div>

            {/* Save Button */}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saveMutation.isPending}
              className="gap-1.5 text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <Check className="size-3.5 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/20 px-3.5 py-2.5 text-xs text-muted-foreground">
        <Info className="size-4 shrink-0 text-primary" />
        <span>
          Environment changes are securely encrypted and injected at container initialization. Restart or redeploy the service to apply new variables to running instances.
        </span>
      </div>

      {/* Editor View */}
      {mode === 'table' ? (
        <EnvTableView envVars={envVars} onChange={handleTableChange} />
      ) : (
        <EnvRawView rawContent={rawText} onChange={handleRawChange} />
      )}
    </div>
  );
}
