'use client';

import React, { useState } from 'react';
import {
  Rocket,
  RotateCw,
  RefreshCw,
  Square,
  Globe,
  ExternalLink,
  Server,
  GitCommit,
  Database,
  Box,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Service } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface ServiceHeaderProps {
  service: Service;
  projectId: string;
  projectName?: string;
  onDeploy?: () => void;
  onRebuild?: () => void;
  onRestart?: () => void;
  onStop?: () => void;
}

export function ServiceHeader({
  service,
  projectId,
  projectName = 'Project',
  onDeploy,
  onRebuild,
  onRestart,
  onStop,
}: ServiceHeaderProps) {
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const primaryDomain = service.domains.find((d) => d.primary) || service.domains[0];

  const handleAction = (type: 'deploy' | 'rebuild' | 'restart' | 'stop') => {
    let msg = '';
    if (type === 'deploy') {
      msg = `Deployment triggered for ${service.name}`;
      onDeploy?.();
    } else if (type === 'rebuild') {
      msg = `Rebuilding ${service.name} from scratch...`;
      onRebuild?.();
    } else if (type === 'restart') {
      msg = `Restarting containers for ${service.name}...`;
      onRestart?.();
    } else {
      msg = `Stopping containers for ${service.name}...`;
      onStop?.();
    }
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  const getTypeIcon = (type: Service['type']) => {
    switch (type) {
      case 'database':
        return Database;
      case 'compose':
        return Box;
      default:
        return Layers;
    }
  };

  const TypeIcon = getTypeIcon(service.type);

  return (
    <div className="space-y-4">
      {/* Toast alert banner if action triggered */}
      {actionMessage && (
        <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3.5 py-2 text-xs font-medium text-primary animate-in fade-in-0 duration-200">
          <CheckCircle2 className="size-4 shrink-0 text-primary" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Header Title & Info */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{service.name}</h1>
            <StatusBadge status={service.status} />
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-xs font-semibold uppercase',
                service.type === 'database'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : service.type === 'compose'
                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                  : 'bg-primary/10 text-primary'
              )}
            >
              <TypeIcon className="size-3" />
              <span>{service.databaseType || service.type}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-0.5">
            <span className="flex items-center gap-1.5 font-mono">
              <Server className="size-3.5 text-muted-foreground" />
              {service.nodeName}
            </span>

            {primaryDomain && (
              <a
                href={`https://${primaryDomain.domain}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary hover:underline transition-colors"
              >
                <Globe className="size-3.5" />
                <span>{primaryDomain.domain}</span>
                <ExternalLink className="size-3" />
              </a>
            )}

            {service.commitHash && (
              <span className="flex items-center gap-1">
                <GitCommit className="size-3.5" />
                <span className="font-mono">{service.commitHash}</span>
                <span>({service.branch})</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {service.type !== 'database' && (
            <>
              <Button
                size="sm"
                onClick={() => handleAction('deploy')}
                className="gap-1.5 text-sm h-9 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Rocket className="size-3.5" />
                <span>Deploy</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction('rebuild')}
                className="gap-1.5 text-sm h-9"
              >
                <RefreshCw className="size-3.5" />
                <span>Rebuild</span>
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('restart')}
            className="gap-1.5 text-sm h-9"
          >
            <RotateCw className="size-3.5" />
            <span>Restart</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('stop')}
            className="gap-1.5 text-sm h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Square className="size-3.5" />
            <span>Stop</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
