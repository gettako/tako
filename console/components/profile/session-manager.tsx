'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSessions, revokeSession, revokeAllOtherSessions } from '@/lib/api/profile';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SessionItem } from './session-item';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LogOut, Laptop } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';

export function SessionManager() {
  const queryClient = useQueryClient();
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
  });

  const revokeSingleMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session revoked successfully');
    },
    onError: () => toast.error('Failed to revoke session'),
  });

  const currentSession = sessions.find((s) => s.current);
  const otherSessions = sessions.filter((s) => !s.current);

  const revokeAllMutation = useMutation({
    mutationFn: () => {
      if (!currentSession) throw new Error('No current session');
      return revokeAllOtherSessions(currentSession.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setBulkDialogOpen(false);
      toast.success('Logged out of all other devices');
    },
    onError: () => toast.error('Failed to revoke sessions'),
  });

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader>
          <SectionHeader
            icon={Laptop}
            title="Active Browser & Device Sessions"
            description="Review browsers and mobile devices currently authenticated to your account."
            action={
              otherSessions.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkDialogOpen(true)}
                  className="text-xs text-status-danger hover:text-status-danger hover:bg-status-danger/10 border-status-danger/40 h-8 gap-1.5 shrink-0"
                >
                  <LogOut className="size-3.5" />
                  Log Out All Other Devices
                </Button>
              )
            }
          />
        </CardHeader>

        <CardContent className="pt-2 space-y-3">
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              onRevoke={(id) => {
                if (confirm('Revoke access for this device session?')) {
                  revokeSingleMutation.mutate(id);
                }
              }}
              isRevoking={revokeSingleMutation.isPending}
            />
          ))}
        </CardContent>
      </Card>

      {/* Bulk Revoke Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-status-danger">
              Log Out of All Other Devices?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This will immediately terminate all {otherSessions.length} other active device sessions. Any open tabs on other computers or phones will require re-authenticating.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBulkDialogOpen(false)}
              className="text-xs h-9 active:not-aria-[haspopup]:translate-y-px"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => revokeAllMutation.mutate()}
              disabled={revokeAllMutation.isPending}
              className="text-xs h-9 bg-status-danger hover:bg-status-danger/90 text-white font-medium active:not-aria-[haspopup]:translate-y-px"
            >
              {revokeAllMutation.isPending ? 'Logging Out...' : 'Confirm Log Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
