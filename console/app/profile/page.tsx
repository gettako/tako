'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, updateCurrentUser } from '@/lib/api/settings';
import { ProfileInfoForm } from '@/components/profile/profile-info-form';
import { PasswordChangeForm } from '@/components/profile/password-change-form';
import { PasskeyManager } from '@/components/profile/passkey-manager';
import { TotpSetupDialog } from '@/components/profile/totp-setup-dialog';
import { SessionManager } from '@/components/profile/session-manager';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Shield, ShieldCheck, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [totpDialogOpen, setTotpDialogOpen] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
  });

  const updateMutation = useMutation({
    mutationFn: updateCurrentUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
    },
  });

  const handleUpdate = async (data: Parameters<typeof updateCurrentUser>[0]) => {
    await updateMutation.mutateAsync(data);
  };

  const handleDisable2FA = async () => {
    if (confirm('Are you sure you want to disable two-factor authentication? This reduces your account security.')) {
      await updateMutation.mutateAsync({ twoFactorEnabled: false });
      toast.success('Two-factor authentication disabled');
    }
  };

  if (isLoading || !user) {
    return (
      <>
        <title>Account & Security — Takō Cloud</title>
        <LoadingSkeleton variant="detail" />
      </>
    );
  }

  return (
    <>
      <title>Account & Security — Takō Cloud</title>
      <div className="space-y-8 max-w-5xl">
        {/* Page Header (Base Vega Gradient Hero) */}
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-primary/5 via-background to-background p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-sans">
                  Account Profile & Security
                </h1>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  <ShieldCheck className="size-3.5 text-primary" />
                  Operator Identity
                </span>
              </div>

              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-normal">
                Manage your credentials, authentication factors, active sessions, and hardware security keys.
              </p>
            </div>
          </div>
        </div>

      {/* 1. Personal Information */}
      <ProfileInfoForm user={user} onUpdate={handleUpdate} />

      {/* 2. Two-Factor Authentication (TOTP) Card (AC-4) */}
      <Card className="border-border/60 bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={ShieldCheck}
            title={
              <div className="flex items-center gap-2">
                <span>Two-Factor Authentication (2FA)</span>
                {user.twoFactorEnabled ? (
                  <Badge
                    variant="outline"
                    className="bg-status-success/10 text-status-success border-status-success/30 font-mono text-[10px] gap-1"
                  >
                    <CheckCircle2 className="size-3" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-status-warning/10 text-status-warning border-status-warning/30 font-mono text-[10px]"
                  >
                    Disabled
                  </Badge>
                )}
              </div>
            }
            description="Add an additional layer of security to your Tako account by requiring a time-based 6-digit code."
            action={
              user.twoFactorEnabled ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDisable2FA}
                  className="text-xs text-status-danger hover:text-status-danger border-status-danger/40 h-8"
                >
                  Disable 2FA
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setTotpDialogOpen(true)}
                  className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-8"
                >
                  Set Up 2FA
                </Button>
              )
            }
          />
        </CardHeader>

        <CardContent className="px-0 pt-2 text-xs text-muted-foreground">
          {user.twoFactorEnabled ? (
            <p>
              Your account is protected with a TOTP authenticator app. Emergency recovery codes are stored.
            </p>
          ) : (
            <p className="text-status-warning">
              Two-factor authentication is currently disabled. We strongly recommend configuring an authenticator app.
            </p>
          )}
        </CardContent>
      </Card>

      {/* TOTP Setup Wizard Dialog */}
      <TotpSetupDialog
        open={totpDialogOpen}
        onOpenChange={setTotpDialogOpen}
        onComplete={async () => {
          await updateMutation.mutateAsync({ twoFactorEnabled: true });
        }}
      />

      {/* 3. Password Change Form */}
      <PasswordChangeForm />

      {/* 4. Passkeys & Biometrics */}
      <PasskeyManager />

      {/* 5. Active Browser & Device Sessions */}
      <SessionManager />
    </div>
  </>
);
}
