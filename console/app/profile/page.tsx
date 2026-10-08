'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, updateCurrentUser, disable2FA, getPasskeys, getSessions } from '@/lib/api/settings';
import { EditProfileDialog } from '@/components/profile/edit-profile-dialog';
import { PasswordChangeForm } from '@/components/profile/password-change-form';
import { PasskeyManager } from '@/components/profile/passkey-manager';
import { TotpSetupDialog } from '@/components/profile/totp-setup-dialog';
import { SessionManager } from '@/components/profile/session-manager';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  User as UserIcon,
  KeyRound,
  Fingerprint,
  Laptop,
  Mail,
  Calendar,
  Sparkles,
  Lock,
  Pencil,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { getUserAvatarUrl, md5 } from '@/lib/avatar';
import { toast } from 'sonner';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [totpDialogOpen, setTotpDialogOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('security');
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
  });

  const { data: passkeys = [] } = useQuery({
    queryKey: ['passkeys'],
    queryFn: getPasskeys,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
  });

  const updateMutation = useMutation({
    mutationFn: updateCurrentUser,
    onSuccess: (updated) => {
      queryClient.setQueryData(['current-user'], updated);
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });

  const handleUpdate = async (data: Parameters<typeof updateCurrentUser>[0]) => {
    await updateMutation.mutateAsync(data);
  };

  const handleDisable2FA = async () => {
    if (confirm('Are you sure you want to disable two-factor authentication? This reduces your account security level.')) {
      try {
        setIsDisabling2FA(true);
        await disable2FA();
        await queryClient.invalidateQueries({ queryKey: ['current-user'] });
        toast.success('Two-factor authentication disabled');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to disable 2FA';
        toast.error(msg);
      } finally {
        setIsDisabling2FA(false);
      }
    }
  };

  if (isLoading || !user) {
    return (
      <>
        <title>Account & Security — Takō Cloud</title>
        <div className="space-y-6 w-full">
          <LoadingSkeleton variant="detail" />
        </div>
      </>
    );
  }

  const avatarUrl = getUserAvatarUrl(user.email, user.avatarUrl);
  const initials = (user.name || 'Administrator')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <title>Account & Security — Takō Cloud</title>
      <div className="space-y-6 w-full pb-12">
        {/* Page Top Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
                Account & Security
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                <ShieldCheck className="size-3.5 text-primary" />
                Operator Identity
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage your credentials, authentication factors, active sessions, and hardware security keys.
            </p>
          </div>
        </div>

        {/* Hero Identity Overview Card (Base Vega Design) */}
        <Card className="border-border bg-card p-6 w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left: Avatar & User Metadata */}
            <div className="flex items-center gap-4.5 min-w-0">
              <Avatar className="size-20 rounded-full border border-border ring-2 ring-primary/20 shrink-0 bg-background">
                <AvatarImage src={avatarUrl} alt={user.name} className="rounded-full object-cover" />
                <AvatarFallback className="rounded-full text-xl font-bold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg font-bold text-foreground tracking-tight truncate">
                    {user.name}
                  </h2>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] uppercase border-primary/40 bg-primary/10 text-primary px-2 py-0.5"
                  >
                    <Shield className="size-3 mr-1" />
                    {user.role}
                  </Badge>
                  {user.twoFactorEnabled ? (
                    <Badge
                      variant="outline"
                      className="bg-status-success/10 text-status-success border-status-success/30 font-mono text-[10px] gap-1 px-2 py-0.5"
                    >
                      <CheckCircle2 className="size-3" />
                      2FA Protected
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-status-warning/10 text-status-warning border-status-warning/30 font-mono text-[10px] gap-1 px-2 py-0.5"
                    >
                      <ShieldAlert className="size-3" />
                      2FA Disabled
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground font-mono pt-0.5">
                  <span className="flex items-center gap-1.5 truncate">
                    <Mail className="size-3.5 text-muted-foreground/70" />
                    {user.email}
                  </span>
                  <span className="flex items-center gap-1.5 font-sans">
                    <Calendar className="size-3.5 text-muted-foreground/70" />
                    Joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      year: 'numeric'
                    }) : '2026'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditProfileOpen(true)}
                    className="h-7 px-2.5 text-xs gap-1.5 active:not-aria-[haspopup]:translate-y-px"
                  >
                    <Pencil className="size-3 text-muted-foreground" />
                    Edit Profile
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: Quick Security Stat Metrics */}
            <div className="grid grid-cols-3 gap-3 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6 shrink-0">
              <div className="space-y-0.5 text-center md:text-left">
                <span className="text-[11px] font-medium text-muted-foreground block">2FA Status</span>
                <span className={user.twoFactorEnabled ? "text-xs font-semibold text-status-success" : "text-xs font-semibold text-status-warning"}>
                  {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <div className="space-y-0.5 text-center md:text-left">
                <span className="text-[11px] font-medium text-muted-foreground block">Passkeys</span>
                <span className="text-xs font-mono font-semibold text-foreground">
                  {passkeys.length} Registered
                </span>
              </div>

              <div className="space-y-0.5 text-center md:text-left">
                <span className="text-[11px] font-medium text-muted-foreground block">Sessions</span>
                <span className="text-xs font-mono font-semibold text-foreground">
                  {sessions.length} Active
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabbed Navigation (Vega Preset Pattern) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1 border border-border rounded-lg h-10 w-full sm:w-auto flex flex-wrap">
            <TabsTrigger value="security" className="text-xs gap-1.5 px-3.5 active:not-aria-[haspopup]:translate-y-px">
              <Lock className="size-3.5" />
              <span>Password & 2FA</span>
            </TabsTrigger>
            <TabsTrigger value="passkeys" className="text-xs gap-1.5 px-3.5 active:not-aria-[haspopup]:translate-y-px">
              <Fingerprint className="size-3.5" />
              <span>Passkeys ({passkeys.length})</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="text-xs gap-1.5 px-3.5 active:not-aria-[haspopup]:translate-y-px">
              <Laptop className="size-3.5" />
              <span>Active Sessions ({sessions.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Password & 2FA */}
          <TabsContent value="security" className="space-y-6 outline-none">
            {/* Two-Factor Authentication (TOTP) Card */}
            <Card className="border-border bg-card p-6">
              <CardHeader className="px-0 pt-0 pb-4">
                <SectionHeader
                  icon={ShieldCheck}
                  title={
                    <div className="flex items-center gap-2">
                      <span>Two-Factor Authentication (2FA)</span>
                      {user.twoFactorEnabled ? (
                        <Badge
                          variant="outline"
                          className="bg-status-success/10 text-status-success border-status-success/30 font-mono text-[10px] gap-1 px-2 py-0.5"
                        >
                          <CheckCircle2 className="size-3" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-status-warning/10 text-status-warning border-status-warning/30 font-mono text-[10px] gap-1 px-2 py-0.5"
                        >
                          Disabled
                        </Badge>
                      )}
                    </div>
                  }
                  description="Protect your Tako operator account with time-based one-time password (TOTP) authentication."
                  action={
                    user.twoFactorEnabled ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDisable2FA}
                        disabled={isDisabling2FA}
                        className="text-xs text-status-danger hover:text-status-danger border-status-danger/40 h-9 active:not-aria-[haspopup]:translate-y-px"
                      >
                        {isDisabling2FA ? 'Disabling...' : 'Disable 2FA'}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setTotpDialogOpen(true)}
                        className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-9 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
                      >
                        <ShieldCheck className="size-3.5" />
                        Set Up 2FA
                      </Button>
                    )
                  }
                />
              </CardHeader>

              <CardContent className="px-0 pt-1 text-xs text-muted-foreground">
                {user.twoFactorEnabled ? (
                  <div className="p-3.5 rounded-lg border border-status-success/20 bg-status-success/5 text-foreground space-y-1">
                    <p className="font-semibold text-status-success flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" />
                      Two-factor authentication is active on this account
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sign-ins require both your password and a 6-digit TOTP code generated by your authenticator app (Google Authenticator, 1Password, or Bitwarden).
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg border border-status-warning/20 bg-status-warning/5 text-foreground space-y-1">
                    <p className="font-semibold text-status-warning flex items-center gap-1.5">
                      <ShieldAlert className="size-4" />
                      Two-factor authentication is currently disabled
                    </p>
                    <p className="text-xs text-muted-foreground">
                      We strongly recommend configuring an authenticator app to protect against unauthorized access to production cluster infrastructure.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Password Change Form */}
            <PasswordChangeForm />
          </TabsContent>

          {/* Tab 3: Passkeys & Biometrics */}
          <TabsContent value="passkeys" className="space-y-6 outline-none">
            <PasskeyManager />
          </TabsContent>

          {/* Tab 4: Active Sessions */}
          <TabsContent value="sessions" className="space-y-6 outline-none">
            <SessionManager />
          </TabsContent>
        </Tabs>

        {/* TOTP Setup Wizard Dialog */}
        <TotpSetupDialog
          open={totpDialogOpen}
          onOpenChange={setTotpDialogOpen}
          onComplete={async () => {
            await queryClient.invalidateQueries({ queryKey: ['current-user'] });
          }}
        />

        {/* Edit Profile Modal Dialog */}
        <EditProfileDialog
          open={editProfileOpen}
          onOpenChange={setEditProfileOpen}
          user={user}
          onUpdate={handleUpdate}
        />
      </div>
    </>
  );
}
