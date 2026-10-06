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
import { Copy, Check, ShieldAlert, Globe, Clock, User } from 'lucide-react';
import { toast } from 'sonner';

interface AuditDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: AuditLog | null;
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

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonContent);
    setCopied(true);
    toast.success('Audit event JSON copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md md:max-w-lg flex flex-col p-6">
        <SheetHeader className="pb-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              {log.targetType}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">{log.id}</span>
          </div>
          <SheetTitle className="text-base font-semibold tracking-tight text-foreground font-mono">
            {log.action}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Recorded security audit event and actor audit trail.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6 text-xs">
          {/* Actor Profile */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Initiating Actor
            </span>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
              <Avatar className="size-9">
                <AvatarImage src={log.actor.avatarUrl} alt={log.actor.name} />
                <AvatarFallback>{getInitials(log.actor.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-semibold text-foreground truncate">{log.actor.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{log.actor.email}</div>
              </div>
            </div>
          </div>

          {/* Event Context Key-Values */}
          <div className="space-y-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Event Context
            </span>
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
              <div>
                <span className="text-[10px] text-muted-foreground block">Target Resource</span>
                <span className="font-medium text-foreground">{log.targetName}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Target ID</span>
                <span className="font-mono text-foreground">{log.targetId}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                  <Globe className="size-2.5" /> Source IP
                </span>
                <span className="font-mono text-foreground">{log.ipAddress}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block flex items-center gap-1">
                  <Clock className="size-2.5" /> Timestamp (UTC)
                </span>
                <span className="font-mono text-foreground text-[11px]">
                  {new Date(log.timestamp).toISOString()}
                </span>
              </div>
            </div>
          </div>

          {/* Structured JSON Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Raw Event Payload
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyJson}
                className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <Check className="size-3 text-status-success" />
                ) : (
                  <Copy className="size-3" />
                )}
                Copy JSON
              </Button>
            </div>
            <pre className="p-3.5 rounded-lg bg-[#0B0C14] text-[#939DB8] font-mono text-[11px] overflow-x-auto border border-white/10 leading-relaxed max-h-72">
              {jsonContent}
            </pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
