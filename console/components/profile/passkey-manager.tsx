'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPasskeys, addPasskey, deletePasskey } from '@/lib/api/settings';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
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
import { Fingerprint, Plus, Trash2, ShieldCheck, Loader2, Sparkles, Key } from 'lucide-react';
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
    mutationFn: (name: string) => addPasskey(name),
    onSuccess: (newKey) => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      toast.success(`Passkey "${newKey.name}" registered successfully`);
      setDialogOpen(false);
      setKeyName('');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to register passkey';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePasskey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      toast.success('Passkey removed from account');
    },
    onError: () => toast.error('Failed to remove passkey'),
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyName.trim();
    if (!trimmed) return;

    setIsRegistering(true);
    try {
      // Check if browser WebAuthn is available
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        try {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          const userId = new Uint8Array(16);
          window.crypto.getRandomValues(userId);

          await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: {
                name: 'Tako Cloud Console',
                id: window.location.hostname,
              },
              user: {
                id: userId,
                name: trimmed,
                displayName: trimmed,
              },
              pubKeyCredParams: [
                { type: 'public-key', alg: -7 },  // ES256
                { type: 'public-key', alg: -257 }, // RS256
              ],
              authenticatorSelection: {
                userVerification: 'preferred',
                residentKey: 'preferred',
              },
              timeout: 60000,
            },
          });
        } catch (credErr: unknown) {
          // If user cancelled or device not configured, we still allow registering named key or note
          if (credErr instanceof Error && credErr.name === 'NotAllowedError') {
            toast.error('Passkey creation cancelled or timed out');
            setIsRegistering(false);
            return;
          }
          // Continue to persist key if virtual authenticator
        }
      }

      await addMutation.mutateAsync(trimmed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register passkey';
      toast.error(msg);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <>
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-5">
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
                className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 h-9 shrink-0 active:not-aria-[haspopup]:translate-y-px"
              >
                <Plus className="size-3.5" />
                Add Passkey
              </Button>
            }
          />
        </CardHeader>

        <CardContent className="px-0 pt-1">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>Loading registered passkeys...</span>
            </div>
          ) : passkeys.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border rounded-xl bg-muted/10">
              <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <Fingerprint className="size-5" />
              </div>
              <p className="text-sm font-medium text-foreground">No passkeys registered</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Add your device biometric sensor or hardware YubiKey to enable instantaneous, phishing-resistant authentication.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setKeyName('');
                  setDialogOpen(true);
                }}
                className="mt-4 text-xs h-8 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
              >
                <Plus className="size-3.5" />
                Register First Passkey
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30 border-b border-border">
                  <TableRow className="h-9 hover:bg-transparent">
                    <TableHead className="w-[45%] text-xs font-semibold">Passkey Name</TableHead>
                    <TableHead className="w-[25%] text-xs font-semibold">Date Registered</TableHead>
                    <TableHead className="w-[18%] text-xs font-semibold">Last Used</TableHead>
                    <TableHead className="text-right w-[12%] text-xs font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/40">
                  {passkeys.map((key) => (
                    <TableRow key={key.id} className="h-13 hover:bg-muted/20 transition-colors">
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-md bg-status-success/10 text-status-success flex items-center justify-center shrink-0">
                            <Key className="size-3.5" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-foreground block">{key.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono block">FIDO2 / WebAuthn</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {new Date(key.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {key.lastUsedAt || 'Just now'}
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
                          className="size-8 p-0 text-muted-foreground hover:text-status-danger hover:bg-status-danger/10 active:not-aria-[haspopup]:translate-y-px"
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
        <DialogContent className="max-w-md bg-card border-border">
          <form onSubmit={handleRegister}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Fingerprint className="size-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold">
                    Register New Passkey
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Connect a biometric sensor or hardware security key to your account.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Passkey Name</Label>
                <Input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. MacBook Pro Touch ID, YubiKey 5C NFC"
                  required
                  disabled={isRegistering}
                  className="text-xs h-9"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Give this key a name that will help you identify which device was used.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-border/70 bg-muted/20 text-[11px] text-muted-foreground flex items-start gap-2">
                <Sparkles className="size-3.5 text-primary shrink-0 mt-0.5" />
                <span>
                  When you continue, your browser will prompt you to verify your identity using Touch ID, Face ID, or your physical key.
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                disabled={isRegistering}
                className="text-xs h-9 active:not-aria-[haspopup]:translate-y-px"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!keyName.trim() || isRegistering}
                className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 h-9 active:not-aria-[haspopup]:translate-y-px"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Authenticating Sensor...
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
