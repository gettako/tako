'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationItem } from './notification-item';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/api/settings';
import { toast } from 'sonner';

export function NotificationPopover() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  });

  const markSingleMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn( buttonVariants({ variant: 'ghost', size: 'icon'}),
          'relative size-9 rounded-md text-muted-foreground hover:text-foreground cursor-pointer'
        )}
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-info opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-status-info" />
          </span>
        )}
        <span className="sr-only">Notifications</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-88 sm:w-96 p-0 overflow-hidden bg-popover border border-border rounded-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {unreadCount} unread
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium transition-colors"
            >
              <CheckCheck className="size-3.5" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>

        {/* Scrollable list */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1 divide-y divide-border/20">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground mb-2">
                <Inbox className="size-5" />
              </div>
              <p className="text-xs font-medium text-foreground">No notifications</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cluster events and deployment alerts will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <NotificationItem
                key={notif.id}
                notification={notif}
                onMarkRead={(id) => markSingleMutation.mutate(id)}
                onNavigate={() => setOpen(false)}
              />
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
