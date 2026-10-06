'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { KeyRound, Lock, Loader2 } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Current password is required');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    try {
      setIsSaving(true);
      await new Promise((r) => setTimeout(r, 400));
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-border bg-card p-6">
      <CardHeader className="px-0 pt-0 pb-4">
        <SectionHeader
          icon={KeyRound}
          title="Change Password"
          description="Update your account password with a strong combination of characters."
        />
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="px-0 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Current Password</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={isSaving}
              className="text-xs max-w-md font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                disabled={isSaving}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                disabled={isSaving}
                className="text-xs font-mono"
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="px-0 pt-4 pb-0 flex justify-end border-t border-border">
          <Button
            type="submit"
            size="sm"
            disabled={!currentPassword || !newPassword || !confirmPassword || isSaving}
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Updating...
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
