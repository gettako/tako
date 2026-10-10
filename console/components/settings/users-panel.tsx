'use client';

import React, { useState } from 'react';
import {
  useCurrentUser,
  useUsers,
  useUpdateUserRole,
  useDeactivateUser,
  useUserInvites,
  useCreateUserInvite,
  useRevokeUserInvite,
} from '@/lib/queries';
import { User, UserRole, UserInvite } from '@/lib/types';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldError } from '@/components/ui/field';
import { parseApiError } from '@/lib/form-errors';
import { ConfirmDestructiveDialog } from '@/components/ui/confirm-destructive-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Users, UserPlus, Mail, Trash2, Shield, Clock, Plus } from 'lucide-react';
import { SettingsSectionHeader } from '@/components/settings/settings-section-header';
import { getUserAvatarUrl } from '@/lib/avatar';

export function UsersPanel() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('member');
  const [inviteExpiry, setInviteExpiry] = useState<number>(7);
  const [inviteEmailError, setInviteEmailError] = useState<string | null>(null);
  const [inviteGeneralError, setInviteGeneralError] = useState<string | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<UserInvite | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { data: currentUser } = useCurrentUser();
  const { data: users = [], isLoading: loadingUsers } = useUsers();
  const { data: invites = [] } = useUserInvites();

  const updateRoleMutation = useUpdateUserRole();
  const deactivateMutation = useDeactivateUser();
  const createInviteMutation = useCreateUserInvite({
    onSuccess: (newInv) => {
      setGeneratedInvite(newInv);
      setInviteEmailError(null);
      setInviteGeneralError(null);
    },
    onError: (err) => {
      const parsed = parseApiError(err);
      if (parsed.is422) {
        if (parsed.fieldErrors.email) {
          setInviteEmailError(parsed.fieldErrors.email);
        } else {
          setInviteGeneralError(parsed.message || 'Validation failed');
        }
      } else {
        setInviteGeneralError(parsed.message || 'Failed to create invite link');
      }
    },
  });
  const revokeInviteMutation = useRevokeUserInvite();

  const getInitials = (n: string) => {
    return n
      .split(' ')
      .map((i) => i[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Team Members Card */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SettingsSectionHeader
            icon={Users}
            title="Team Members & Permissions"
            description="Manage operators who can deploy services, configure cluster settings, and inspect logs."
            action={
              <Button
                size="default"
                onClick={() => {
                  setInviteEmail('');
                  setGeneratedInvite(null);
                  setInviteDialogOpen(true);
                }}
                className="text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 shrink-0 active:not-aria-[haspopup]:translate-y-px"
              >
                <UserPlus className="size-4" />
                Invite Member
              </Button>
            }
          />
        </CardHeader>

        <CardContent className="px-0 pt-2">
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/40 border-b border-border">
                <TableRow className="h-10 hover:bg-transparent">
                  <TableHead className="w-[32%]">Member</TableHead>
                  <TableHead className="w-[20%]">Role</TableHead>
                  <TableHead className="w-[18%]">2FA Status</TableHead>
                  <TableHead className="w-[18%]">Member Since</TableHead>
                  <TableHead className="text-right w-[12%]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/40">
                {users.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  const isOwner = u.role === 'owner';
                  return (
                    <TableRow key={u.id} className="h-14 hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-10 text-xs border border-border/70 shrink-0">
                            <AvatarImage src={getUserAvatarUrl(u.email, u.avatarUrl)} alt={u.name} />
                            <AvatarFallback className="font-semibold bg-primary/10 text-primary">{getInitials(u.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isCurrent && (
                                <span className="text-xs text-muted-foreground font-normal">
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Role selection */}
                      <TableCell>
                        {isOwner || isCurrent ? (
                          <Badge
                            variant="outline"
                            className="font-mono text-xs uppercase border-primary/40 bg-primary/10 text-primary"
                          >
                            {u.role}
                          </Badge>
                        ) : (
                          <div className="w-32">
                            <SearchableSelect
                              value={u.role}
                              onValueChange={(val) =>
                                updateRoleMutation.mutate({
                                  userId: u.id,
                                  role: val as UserRole,
                                })
                              }
                              options={[
                                { value: 'member', label: 'member', description: 'Deploy and read' },
                                { value: 'admin', label: 'admin', description: 'Cluster admin' },
                                { value: 'owner', label: 'owner', description: 'Full owner' },
                              ]}
                              size="sm"
                              className="font-mono text-xs"
                              searchPlaceholder="Filter role..."
                            />
                          </div>
                        )}
                      </TableCell>

                      {/* 2FA */}
                      <TableCell>
                        {u.twoFactorEnabled ? (
                          <span className="text-status-success font-medium text-xs">Enabled</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Disabled</span>
                        )}
                      </TableCell>

                      {/* Created date */}
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        {!isOwner && !isCurrent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setUserToDelete(u)}
                            className="size-8 p-0 text-muted-foreground hover:text-status-danger active:not-aria-[haspopup]:translate-y-px"
                            title="Deactivate user"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites Card */}
      {invites.length > 0 && (
        <Card className="border-border bg-card p-6">
          <CardHeader className="px-0 pt-0 pb-4">
            <SettingsSectionHeader
              icon={Mail}
              title="Pending Member Invitations"
              description="Outstanding invite links awaiting recipient registration."
            />
          </CardHeader>

          <CardContent className="px-0 pt-2">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40 border-b border-border">
                  <TableRow className="h-10 hover:bg-transparent">
                    <TableHead className="w-[35%]">Invited Email</TableHead>
                    <TableHead className="w-[20%]">Role</TableHead>
                    <TableHead className="w-[25%]">Expires In</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((inv) => (
                    <TableRow key={inv.id} className="h-14 border-b border-border hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono font-medium text-foreground">
                        {inv.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-mono text-xs uppercase border-border bg-muted/30"
                        >
                          {inv.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <CopyButton
                            value={`https://console.gettako.dev/invite?token=${inv.token}`}
                            label="invite link"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeInviteMutation.mutate(inv.id)}
                            className="size-8 p-0 text-muted-foreground hover:text-status-danger active:not-aria-[haspopup]:translate-y-px"
                            title="Revoke invite"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Member Dialog (AC-8) */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Invite Team Member
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Generate a secure, single-use invite URL to grant cluster access.
            </DialogDescription>
          </DialogHeader>

          {generatedInvite ? (
            <div className="space-y-4 py-3 text-sm">
              <div className="p-3 rounded-lg border border-status-success/30 bg-status-success/10 text-status-success font-medium">
                Invitation created successfully for {generatedInvite.email}!
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-muted-foreground">Shareable Invite Link:</span>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`https://console.gettako.dev/invite?token=${generatedInvite.token}`}
                    className="font-mono text-sm bg-muted/40"
                  />
                  <CopyButton
                    text={`https://console.gettako.dev/invite?token=${generatedInvite.token}`}
                    tooltip="Copy invite URL"
                    className="h-9 px-3 text-sm shrink-0"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  size="default"
                  onClick={() => setInviteDialogOpen(false)}
                  className="w-full text-sm font-medium h-9 active:not-aria-[haspopup]:translate-y-px"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setInviteGeneralError(null);
                const trimmed = inviteEmail.trim();
                if (!trimmed) {
                  setInviteEmailError('Email address is required');
                  return;
                }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
                  setInviteEmailError('Please enter a valid email address');
                  return;
                }
                createInviteMutation.mutate({
                  email: trimmed,
                  role: inviteRole,
                  expiryDays: inviteExpiry,
                });
              }}
              className="space-y-4 py-3 text-sm"
              noValidate
            >
              {inviteGeneralError && (
                <div role="alert" className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-md">
                  {inviteGeneralError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Email Address</Label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    if (inviteEmailError) setInviteEmailError(null);
                  }}
                  error={!!inviteEmailError}
                  className="text-sm"
                />
                <FieldError error={inviteEmailError} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Assigned Role</Label>
                  <SearchableSelect
                    value={inviteRole}
                    onValueChange={(val) => setInviteRole(val as UserRole)}
                    options={[
                      { value: 'member', label: 'member', description: 'Read and deploy' },
                      { value: 'admin', label: 'admin', description: 'Full admin access' },
                    ]}
                    searchPlaceholder="Filter role..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Link Expiration</Label>
                  <SearchableSelect
                    value={String(inviteExpiry)}
                    onValueChange={(val) => setInviteExpiry(Number(val))}
                    options={[
                      { value: '1', label: '24 hours' },
                      { value: '7', label: '7 days' },
                      { value: '30', label: '30 days' },
                    ]}
                    searchPlaceholder="Filter duration..."
                  />
                </div>
              </div>

              <DialogFooter className="pt-2 gap-2 sm:gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInviteDialogOpen(false)}
                  className="text-sm h-9 active:not-aria-[haspopup]:translate-y-px"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!inviteEmail.trim() || createInviteMutation.isPending}
                  className="text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium active:not-aria-[haspopup]:translate-y-px"
                >
                  {createInviteMutation.isPending ? 'Generating...' : 'Generate Invite Link'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Deactivate Dialog */}
      <ConfirmDestructiveDialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
        title="Deactivate Team Member"
        description={`Are you sure you want to remove ${userToDelete?.name} (${userToDelete?.email}) from the cluster? They will immediately lose access to cluster resources and deployment actions.`}
        confirmText="Deactivate Member"
        onConfirm={async () => {
          if (userToDelete) {
            await deactivateMutation.mutateAsync(userToDelete.id);
            setUserToDelete(null);
          }
        }}
        isPending={deactivateMutation.isPending}
      />
    </div>
  );
}
