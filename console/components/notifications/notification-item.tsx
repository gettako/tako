'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, CheckCircle, Info, ExternalLink, Check } from 'lucide-react';
import { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onNavigate?: () => void;
}

export function NotificationItem({ notification, onMarkRead, onNavigate }: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.type) {
      case 'error':
        return <AlertCircle className="size-4 text-status-danger shrink-0" />;
      case 'warning':
        return <AlertTriangle className="size-4 text-status-warning shrink-0" />;
      case 'success':
        return <CheckCircle className="size-4 text-status-success shrink-0" />;
      case 'info':
      default:
        return <Info className="size-4 text-status-info shrink-0" />;
    }
  };

  const getFormatTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
  };

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 p-3 text-xs transition-colors rounded-lg border border-transparent',
        !notification.read
          ? 'bg-primary/5 hover:bg-primary/10 border-primary/10'
          : 'hover:bg-muted/50'
      )}
    >
      <div className="mt-0.5">{getIcon()}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-foreground truncate">{notification.title}</span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {getFormatTime(notification.timestamp)}
          </span>
        </div>

        <p className="mt-1 text-muted-foreground line-clamp-2 leading-relaxed">
          {notification.message}
        </p>

        <div className="mt-2 flex items-center justify-between gap-2">
          {notification.link ? (
            <Link
              href={notification.link}
              onClick={onNavigate}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <span>Inspect resource</span>
              <ExternalLink className="size-3" />
            </Link>
          ) : (
            <div />
          )}

          {!notification.read && (
            <button
              onClick={() => onMarkRead(notification.id)}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground opacity-80 group-hover:opacity-100 transition-opacity"
              title="Mark as read"
            >
              <Check className="size-3" />
              <span>Mark read</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
