'use client';

import React, { useState, useMemo } from 'react';
import { TraefikAccessLogEntry } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Copy,
  Check,
  Globe,
  Clock,
  Server,
  Layers,
  Box,
  FileCode,
  ShieldAlert,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';

interface IngressLogDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: TraefikAccessLogEntry | null;
}

export function IngressLogDetailSheet({
  open,
  onOpenChange,
  log,
}: IngressLogDetailSheetProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const formattedRawJson = useMemo(() => {
    if (!log) return '';
    if (log.rawJson) {
      try {
        return JSON.stringify(JSON.parse(log.rawJson), null, 2);
      } catch {
        return log.rawJson;
      }
    }
    return JSON.stringify(log, null, 2);
  }, [log]);

  const highlightedJson = useMemo(() => {
    if (!formattedRawJson) return '';
    try {
      if (Prism.languages.json) {
        return Prism.highlight(formattedRawJson, Prism.languages.json, 'json');
      }
    } catch {
      // Fallback
    }
    return formattedRawJson;
  }, [formattedRawJson]);

  const jsonLineCount = useMemo(() => {
    return formattedRawJson ? formattedRawJson.split('\n').length : 0;
  }, [formattedRawJson]);

  if (!log) return null;

  const handleCopyText = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusBadgeVariant = (code: number) => {
    if (code >= 200 && code < 300) {
      return 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30';
    }
    if (code >= 300 && code < 400) {
      return 'bg-blue-500/10 text-blue-700 dark:bg-[#98A4F7]/15 dark:text-[#98A4F7] border-blue-500/20 dark:border-[#98A4F7]/30';
    }
    if (code >= 400 && code < 500) {
      return 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/25';
    }
    return 'bg-red-500/10 text-red-700 dark:bg-[#FF5A6A]/15 dark:text-[#FF5A6A] border-red-500/20 dark:border-[#FF5A6A]/30';
  };

  const getMethodBadgeVariant = (method: string) => {
    const m = (method || 'GET').toUpperCase();
    switch (m) {
      case 'GET':
        return 'text-blue-600 dark:text-[#98A4F7] border-blue-500/30 bg-blue-500/10';
      case 'POST':
        return 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'PUT':
      case 'PATCH':
        return 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'DELETE':
        return 'text-red-600 dark:text-[#FF5A6A] border-red-500/30 bg-red-500/10';
      default:
        return 'text-muted-foreground border-border bg-muted/40';
    }
  };

  const fullUrl = log.host ? `https://${log.host}${log.path}` : log.path;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[540px] md:w-[600px] lg:w-[42vw] max-w-full sm:max-w-[55vw] xl:max-w-[680px] flex flex-col p-0 gap-0 border-l border-border bg-background"
      >
        {/* Sheet Header - Strict Base Vega No-Icon Rule */}
        <SheetHeader className="p-5 sm:p-6 pb-4 sm:pb-5 border-b border-border bg-muted/15 dark:bg-muted/5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap pr-8">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={cn('font-mono text-xs font-bold px-2 py-0.5 uppercase tracking-wide', getMethodBadgeVariant(log.method))}
              >
                {log.method}
              </Badge>
              <Badge
                variant="outline"
                className={cn('font-mono text-xs font-bold px-2.5 py-0.5', getStatusBadgeVariant(log.statusCode))}
              >
                {log.statusCode}
              </Badge>
              <Badge
                variant="outline"
                className="font-mono text-xs px-2 py-0.5 border-border bg-muted/40 text-muted-foreground"
              >
                {log.durationMs.toFixed(1)} ms
              </Badge>
              <Badge
                variant="outline"
                className="font-mono text-xs px-2 py-0.5 border-border bg-muted/40 text-muted-foreground"
              >
                {log.protocol || 'HTTP/1.1'}
              </Badge>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {new Date(log.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <SheetTitle className="text-lg font-bold tracking-tight text-foreground font-sans">
              Ingress Access Event
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground font-mono">
              Captured at {new Date(log.timestamp).toISOString()}
            </SheetDescription>
          </div>

          {/* Quick URL Bar */}
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-card border border-border mt-1">
            <span
              className="font-mono text-xs text-foreground truncate select-all flex-1 min-w-0"
              title={fullUrl}
            >
              {log.host && <span className="text-muted-foreground">https://{log.host}</span>}
              <strong className="text-foreground">{log.path}</strong>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopyText(fullUrl, 'url', 'Request URL')}
              className="h-7 px-2.5 text-xs gap-1.5 shrink-0 text-muted-foreground hover:text-foreground active:not-aria-[haspopup]:translate-y-px cursor-pointer"
            >
              {copiedKey === 'url' ? (
                <Check className="size-3.5 text-status-success" />
              ) : (
                <Copy className="size-3.5" />
              )}
              <span>{copiedKey === 'url' ? 'Copied' : 'Copy URL'}</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-6">
          {/* Section 1: Ingress Gateway & Routing Metadata */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground shrink-0">
                <Layers className="size-3.5" />
              </div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Routing & Gateway Telemetry
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
              <div className="p-3 rounded-lg bg-card border border-border flex items-center justify-between">
                <span className="text-muted-foreground font-sans text-xs">Client IP</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">{log.clientIp}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(log.clientIp, 'ip', 'Client IP')}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer transition-colors"
                    title="Copy IP"
                  >
                    {copiedKey === 'ip' ? (
                      <Check className="size-3 text-status-success" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border flex items-center justify-between">
                <span className="text-muted-foreground font-sans text-xs">Ingress Node</span>
                <span className="font-semibold text-foreground truncate max-w-[170px]" title={log.nodeName || log.nodeId || 'master'}>
                  {log.nodeName || log.nodeId || 'master'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border flex items-center justify-between">
                <span className="text-muted-foreground font-sans text-xs">Traefik Router</span>
                <span className="font-semibold text-foreground truncate max-w-[170px]" title={log.routerName}>
                  {log.routerName || '—'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border flex items-center justify-between">
                <span className="text-muted-foreground font-sans text-xs">Target Service</span>
                <span className="font-semibold text-foreground truncate max-w-[170px]" title={log.serviceName}>
                  {log.serviceName || '—'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border flex items-center justify-between">
                <span className="text-muted-foreground font-sans text-xs">Host Header</span>
                <span className="font-semibold text-foreground truncate max-w-[170px]" title={log.host}>
                  {log.host || '—'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-card border border-border flex items-center justify-between">
                <span className="text-muted-foreground font-sans text-xs">Reverse-Proxy Latency</span>
                <span
                  className={cn(
                    'font-semibold font-mono',
                    log.durationMs > 200
                      ? 'text-status-danger'
                      : log.durationMs > 50
                      ? 'text-status-warning'
                      : 'text-status-success'
                  )}
                >
                  {log.durationMs.toFixed(2)} ms
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Client User-Agent Header */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground shrink-0">
                  <Globe className="size-3.5" />
                </div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Client User-Agent
                </h4>
              </div>
              {log.userAgent && (
                <button
                  type="button"
                  onClick={() => handleCopyText(log.userAgent, 'ua', 'User-Agent')}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  {copiedKey === 'ua' ? (
                    <Check className="size-3 text-status-success" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>Copy</span>
                </button>
              )}
            </div>
            <div className="p-3 rounded-lg bg-card border border-border text-xs font-mono break-all leading-relaxed text-foreground select-all">
              {log.userAgent || 'No User-Agent header recorded'}
            </div>
          </div>

          {/* Section 3: Full Raw JSON Telemetry */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground shrink-0">
                  <FileCode className="size-3.5" />
                </div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Complete Traefik JSON Telemetry
                </h4>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyText(formattedRawJson, 'json', 'JSON payload')}
                className="h-7 text-xs gap-1.5 border-border active:not-aria-[haspopup]:translate-y-px cursor-pointer"
              >
                {copiedKey === 'json' ? (
                  <Check className="size-3 text-status-success" />
                ) : (
                  <Copy className="size-3" />
                )}
                <span>{copiedKey === 'json' ? 'Copied' : 'Copy JSON'}</span>
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden bg-card">
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-muted/40 text-xs text-muted-foreground font-mono">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-status-success" />
                  <span>traefik-telemetry.json</span>
                </div>
                <span>{jsonLineCount} lines</span>
              </div>
              <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto whitespace-pre leading-relaxed select-all max-h-[340px] overflow-y-auto">
                <code
                  className="language-json"
                  dangerouslySetInnerHTML={{
                    __html: highlightedJson,
                  }}
                />
              </pre>
            </div>
          </div>
        </div>

        {/* Sheet Fixed Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-border bg-muted/15 dark:bg-muted/5 flex items-center justify-between shrink-0">
          <span className="text-xs font-mono text-muted-foreground">
            UTC: {log.timestamp}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs active:not-aria-[haspopup]:translate-y-px cursor-pointer"
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
