'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { KeyRound, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { FieldError } from '@/components/ui/field';
import { parseApiError } from '@/lib/form-errors';
import { useChangePassword } from '@/lib/queries';
import { toast } from 'sonner';

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (generalError) setGeneralError('');
  };

  const changePasswordMutation = useChangePassword({
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFieldErrors({});
      setGeneralError('');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    if (newPassword.length < 8) {
      errors.newPassword = 'New password must be at least 8 characters long';
    }
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'New password and confirmation do not match';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      setIsSaving(true);
      setFieldErrors({});
      setGeneralError('');
      await changePasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
      });
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.is422) {
        setFieldErrors(parsed.fieldErrors);
        setGeneralError(parsed.message || 'Validation failed');
      } else {
        toast.error(parsed.message || 'Failed to update password');
      }
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
          {generalError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
              {generalError}
            </div>
          )}

          {/* Current Password */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Lock className="size-3.5 text-muted-foreground" />
              Current Password
            </Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                clearFieldError('currentPassword');
              }}
              placeholder="••••••••••••"
              disabled={isSaving}
              error={!!fieldErrors.currentPassword}
              className="text-xs h-9 font-mono"
            />
            <FieldError error={fieldErrors.currentPassword} />
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
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  clearFieldError('newPassword');
                }}
                placeholder="At least 8 characters"
                disabled={isSaving}
                error={!!fieldErrors.newPassword}
                className="text-xs h-9 font-mono"
              />
              <FieldError error={fieldErrors.newPassword} />
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
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearFieldError('confirmPassword');
                }}
                placeholder="Repeat new password"
                disabled={isSaving}
                error={!!fieldErrors.confirmPassword}
                className="text-xs h-9 font-mono"
              />
              <FieldError error={fieldErrors.confirmPassword} />
              {confirmPassword && newPassword !== confirmPassword && !fieldErrors.confirmPassword && (
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
            disabled={isSaving}
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
