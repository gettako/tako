'use client';

import React, { useState } from 'react';
import { AuditLog } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Copy,
  Check,
  Globe,
  Clock,
  User,
  Hash,
  Layers,
  ShieldCheck,
  FolderGit2,
  Server,
  HardDrive,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AuditDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: AuditLog | null;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getTargetBadgeColor(type: string) {
  switch (type) {
    case 'service':
      return 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:bg-blue-500/15 dark:text-[#98A4F7] dark:border-blue-500/30';
    case 'node':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30';
    case 'user':
    case 'auth':
      return 'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30';
    case 'project':
      return 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/30';
    case 'settings':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function getTargetIcon(type: string) {
  switch (type) {
    case 'service':
      return Server;
    case 'node':
      return HardDrive;
    case 'user':
    case 'auth':
      return ShieldCheck;
    case 'project':
      return FolderGit2;
    case 'settings':
      return SlidersHorizontal;
    default:
      return Layers;
  }
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function highlightJson(json: string): string {
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'text-amber-400';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-[#98A4F7] font-medium';
        } else {
          cls = 'text-emerald-400';
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-indigo-400 font-semibold';
      } else if (/null/.test(match)) {
        cls = 'text-slate-400 italic';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

export function AuditDetailDrawer({
  open,
  onOpenChange,
  log,
}: AuditDetailDrawerProps) {
  const [copied, setCopied] = useState(false);

  if (!log) return null;

  const jsonContent = JSON.stringify(
    {
      id: log.id,
      timestamp: log.timestamp,
      actor: log.actor,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      targetName: log.targetName,
      ipAddress: log.ipAddress,
      metadata: log.metadata || {},
    },
    null,
    2
  );

  const jsonLines = jsonContent.split('\n');
  const highlighted = highlightJson(jsonContent);
  const TargetIcon = getTargetIcon(log.targetType);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonContent);
    setCopied(true);
    toast.success('Audit event JSON copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[500px] md:w-[540px] lg:w-[38vw] xl:w-[35vw] max-w-full sm:max-w-[50vw] xl:max-w-[640px] flex flex-col p-0 gap-0 border-l border-border/80 bg-background dark:bg-[#0B0C14] shadow-2xl"
      >
        {/* Section Header (Base Vega Squircle Icon Pattern) */}
        <SheetHeader className="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-border/60 bg-muted/15 dark:bg-muted/5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={cn(
                  'font-mono text-xs uppercase font-semibold px-2.5 py-0.5 tracking-wider',
                  getTargetBadgeColor(log.targetType)
                )}
              >
                {log.targetType}
              </Badge>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/50">
                {log.id}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                <Clock className="size-3" />
                {formatRelativeTime(log.timestamp)}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <SheetTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-mono break-all leading-tight">
              {log.action}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground leading-normal">
              Cryptographically tracked immutable security ledger event record.
            </SheetDescription>
          </div>
        </SheetHeader>

        {/* Scrollable Inspection Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-sm">
          {/* 1. Initiating Actor Profile Card */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Initiating Actor
              </span>
              <span className="text-xs font-mono text-muted-foreground">ID: {log.actor.id}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="size-10 border border-border/80 shadow-2xs shrink-0">
                  <AvatarImage src={log.actor.avatarUrl} alt={log.actor.name} />
                  <AvatarFallback className="font-semibold text-xs sm:text-sm bg-primary/10 text-primary">
                    {getInitials(log.actor.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm sm:text-base font-semibold text-foreground truncate">
                    {log.actor.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate font-mono">
                    {log.actor.email}
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2 self-start sm:self-auto">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-muted/60 text-muted-foreground border border-border/60">
                  <User className="size-3.5 text-muted-foreground" />
                  Operator Profile
                </span>
              </div>
            </div>
          </div>

          {/* 2. Event Context Key-Values Grid (2x2 Balanced Side-Drawer Layout) */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Event Context & Telemetry
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Target Resource */}
              <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1.5 min-w-0">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <TargetIcon className="size-3.5 text-muted-foreground shrink-0" />
                  Target Resource
                </span>
                <div className="text-sm font-semibold text-foreground truncate" title={log.targetName}>
                  {log.targetName}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground uppercase">
                  Type: {log.targetType}
                </div>
              </div>

              {/* Target ID */}
              <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1.5 min-w-0">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Hash className="size-3.5 text-muted-foreground shrink-0" />
                  Target ID
                </span>
                <div
                  className="text-xs sm:text-sm font-mono text-foreground truncate select-all"
                  title={log.targetId}
                >
                  {log.targetId}
                </div>
                <div className="text-[11px] text-muted-foreground">Primary identifier</div>
              </div>

              {/* Source IP */}
              <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1.5 min-w-0">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Globe className="size-3.5 text-muted-foreground shrink-0" />
                  Source IP
                </span>
                <div className="text-xs sm:text-sm font-mono text-foreground truncate select-all">
                  {log.ipAddress}
                </div>
                <div className="text-[11px] text-muted-foreground">Inbound network origin</div>
              </div>

              {/* Timestamp */}
              <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1.5 min-w-0">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground shrink-0" />
                  Recorded At
                </span>
                <div className="text-xs sm:text-sm font-semibold text-foreground truncate">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground truncate">
                  {new Date(log.timestamp).toISOString()}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Event Metadata Breakdown (if present) */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div className="space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Structured Metadata Attributes
              </span>
              <div className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(log.metadata).map(([key, val]) => (
                    <div
                      key={key}
                      className="p-3 rounded-lg bg-muted/40 border border-border/60 space-y-1"
                    >
                      <span className="text-[11px] font-mono text-muted-foreground uppercase font-semibold">
                        {key}
                      </span>
                      <div className="text-xs sm:text-sm font-mono font-medium text-foreground break-all">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. Raw Event Payload (Better Stack Dark & Base Vega styled JSON Viewer) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Raw Event Payload
                </span>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/50">
                  {jsonLines.length} lines • {new Blob([jsonContent]).size} B
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyJson}
                className="h-8 text-xs gap-1.5 border-border/80 bg-card hover:bg-muted/60 active:not-aria-[haspopup]:translate-y-px shadow-2xs cursor-pointer"
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-500 dark:text-emerald-400" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </Button>
            </div>

            <div className="rounded-xl bg-[#0B0C14] border border-white/14 shadow-inner overflow-hidden">
              {/* Window title bar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 text-xs font-mono text-[#939DB8]">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-400 shadow-xs" />
                  <span className="text-white/80 font-medium">audit-event-{log.id}.json</span>
                </div>
                <span className="text-[11px] opacity-70">application/json</span>
              </div>

              {/* Code display */}
              <div className="p-4 sm:p-5 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto max-h-[460px] overflow-y-auto">
                <pre className="text-[#939DB8] font-mono leading-relaxed whitespace-pre">
                  <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                </pre>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
