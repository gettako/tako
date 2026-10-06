'use client';

import React from 'react';
import { Session } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Laptop, Smartphone, Monitor, Globe, LogOut, CheckCircle2 } from 'lucide-react';

interface SessionItemProps {
  session: Session;
  onRevoke: (id: string) => void;
  isRevoking?: boolean;
}

export function SessionItem({ session, onRevoke, isRevoking }: SessionItemProps) {
  const isMobile =
    session.device.toLowerCase().includes('iphone') ||
    session.device.toLowerCase().includes('android');

  const DeviceIcon = isMobile ? Smartphone : Laptop;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border/60 bg-muted/20 gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2 rounded-md bg-muted text-muted-foreground shrink-0 mt-0.5">
          <DeviceIcon className="size-4" />
        </div>
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-foreground truncate">
              {session.device}
            </span>
            {session.current && (
              <Badge
                variant="outline"
                className="bg-status-success/10 text-status-success border-status-success/30 font-mono text-[10px] gap-1"
              >
                <CheckCircle2 className="size-3" />
                This Session
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground font-mono">
            <span>{session.ipAddress}</span>
            <span>•</span>
            <span className="font-sans flex items-center gap-1">
              <Globe className="size-2.5" />
              {session.location}
            </span>
            <span>•</span>
            <span className="font-sans">Active: {session.lastActive}</span>
          </div>
        </div>
      </div>

      {!session.current && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRevoke(session.id)}
          disabled={isRevoking}
          className="text-xs text-status-danger hover:text-status-danger hover:bg-status-danger/10 border-status-danger/30 h-8 self-end sm:self-auto shrink-0"
        >
          <LogOut className="size-3.5 mr-1" />
          Revoke
        </Button>
      )}
    </div>
  );
}
