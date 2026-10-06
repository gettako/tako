'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPasskeys, addPasskey, deletePasskey } from '@/lib/api/settings';
import { Passkey } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Fingerprint, Plus, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';

export function PasskeyManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const { data: passkeys = [], isLoading } = useQuery({
    queryKey: ['passkeys'],
    queryFn: getPasskeys,
  });

  const addMutation = useMutation({
    mutationFn: addPasskey,
    onSuccess: (newKey) => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      toast.success(`Passkey "${newKey.name}" registered successfully`);
      setDialogOpen(false);
      setKeyName('');
    },
    onError: () => toast.error('Failed to register passkey'),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePasskey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      toast.success('Passkey removed');
    },
    onError: () => toast.error('Failed to remove passkey'),
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    try {
      setIsRegistering(true);
      await new Promise((r) => setTimeout(r, 600)); // simulated biometric delay
      await addMutation.mutateAsync(keyName.trim());
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <>
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Fingerprint}
            title="Passkeys & Biometrics"
            description="Sign in securely without passwords using Touch ID, Face ID, Windows Hello, or physical security keys."
            action={
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setKeyName('');
                  setDialogOpen(true);
                }}
                className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 shrink-0"
              >
                <Plus className="size-3.5" />
                Add Passkey
              </Button>
            }
          />
        </CardHeader>

        <CardContent className="px-0 pt-2">
          {passkeys.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg">
              <Fingerprint className="size-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No passkeys registered yet.</p>
              <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                Add a hardware key or device biometric to enable fast, passwordless login.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40 border-b border-border">
                  <TableRow className="h-11 hover:bg-transparent">
                    <TableHead className="w-[40%]">Passkey Name</TableHead>
                    <TableHead className="w-[25%]">Created Date</TableHead>
                    <TableHead className="w-[20%]">Last Used</TableHead>
                    <TableHead className="text-right w-[15%]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/40">
                  {passkeys.map((key) => (
                    <TableRow key={key.id} className="h-14 hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold text-foreground flex items-center gap-2">
                        <ShieldCheck className="size-3.5 text-status-success shrink-0" />
                        <span>{key.name}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {key.lastUsedAt || 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Remove passkey "${key.name}"?`)) {
                              deleteMutation.mutate(key.id);
                            }
                          }}
                          className="size-8 p-0 text-muted-foreground hover:text-status-danger active:not-aria-[haspopup]:translate-y-px"
                          title="Remove passkey"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Passkey Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleRegister}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Register New Passkey
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Give your device or security key a memorable name before authenticating.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Passkey Name</Label>
              <Input
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. MacBook Pro Touch ID, YubiKey 5C"
                required
                disabled={isRegistering}
                className="text-xs"
                autoFocus
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                disabled={isRegistering}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!keyName.trim() || isRegistering}
                className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Touch Sensor...
                  </>
                ) : (
                  'Continue & Authenticate'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
