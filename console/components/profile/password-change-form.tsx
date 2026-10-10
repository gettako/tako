'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { KeyRound, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { useChangePassword } from '@/lib/queries';
import { toast } from 'sonner';

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const changePasswordMutation = useChangePassword({
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Current password is required');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }

    try {
      setIsSaving(true);
      await changePasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
      });
    } catch {
      // Error handled by mutation toast
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-5">
        <SectionHeader
          icon={KeyRound}
          title="Account Password"
          description="Update your password to keep your Tako cluster operator account secure."
        />
      </CardHeader>

      <form onSubmit={handleSubmit} className="space-y-5">
        <CardContent className="space-y-4 pb-6">
          {/* Current Password */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Lock className="size-3.5 text-muted-foreground" />
              Current Password
            </Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={isSaving}
              className="text-xs h-9 font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* New Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-muted-foreground" />
                New Password
              </Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={isSaving}
                className="text-xs h-9 font-mono"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Minimum 8 characters with a mix of letters and numbers.
              </p>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-muted-foreground" />
                Confirm New Password
              </Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                disabled={isSaving}
                className="text-xs h-9 font-mono"
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[11px] text-status-danger flex items-center gap-1">
                  <AlertCircle className="size-3" /> Passwords do not match
                </p>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-6 pb-0 flex items-center justify-between border-t border-border">
          <span className="text-[11px] text-muted-foreground">
            Changes will invalidate other active sessions for security.
          </span>

          <Button
            type="submit"
            size="sm"
            disabled={!isFormValid || isSaving}
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 h-9 active:not-aria-[haspopup]:translate-y-px"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Updating Password...
              </>
            ) : (
              <>
                <Lock className="size-3.5" />
                Update Password
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
