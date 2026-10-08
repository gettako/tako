'use client';

import React, { useState, useEffect } from 'react';
import { User } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Mail, Save, Loader2, Sparkles, Hash } from 'lucide-react';
import { getUserAvatarUrl, md5 } from '@/lib/avatar';
import { toast } from 'sonner';

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onUpdate: (data: Partial<User>) => Promise<void>;
}

export function EditProfileDialog({
  open,
  onOpenChange,
  user,
  onUpdate,
}: EditProfileDialogProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [open, user.name, user.email]);

  const previewAvatarUrl = getUserAvatarUrl(email);
  const emailHash = md5(email.trim().toLowerCase());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    try {
      setIsSaving(true);
      await onUpdate({
        name: name.trim(),
        email: email.trim(),
        avatarUrl: previewAvatarUrl,
      });
      toast.success('Profile updated successfully');
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (n: string) => {
    return (n || 'AD')
      .split(' ')
      .map((i) => i[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Edit Account Profile
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update your display name and email address. The avatar is updated deterministically.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Live Avatar Preview */}
            <div className="flex items-center gap-3.5 p-3 rounded-xl border border-border bg-muted/20">
              <Avatar className="size-14 rounded-full border border-border ring-2 ring-primary/20 shrink-0 bg-background">
                <AvatarImage src={previewAvatarUrl} alt={name} className="rounded-full object-cover" />
                <AvatarFallback className="rounded-full text-base font-semibold bg-primary/10 text-primary">
                  {getInitials(name)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 font-mono text-xs text-foreground font-semibold">
                  <Sparkles className="size-3 text-primary shrink-0" />
                  <span>Dicebear Big-Smile</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground truncate">
                  <Hash className="size-2.5 shrink-0" />
                  <span>seed: {emailHash.slice(0, 16)}...</span>
                </div>
              </div>
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <UserIcon className="size-3.5 text-muted-foreground" />
                Full Display Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Administrator"
                disabled={isSaving}
                className="text-xs h-9"
                required
                autoFocus
              />
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" />
                Email Address
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gettako.dev"
                disabled={isSaving}
                className="text-xs h-9 font-mono"
                required
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="text-xs h-9 active:not-aria-[haspopup]:translate-y-px"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || !name.trim() || !email.trim()}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 h-9 active:not-aria-[haspopup]:translate-y-px"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
