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
import { FieldError } from '@/components/ui/field';
import { parseApiError } from '@/lib/form-errors';

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user.name);
      setEmail(user.email);
      setFieldErrors({});
      setGeneralError(null);
    }
  }, [open, user.name, user.email]);

  const previewAvatarUrl = getUserAvatarUrl(email);
  const emailHash = md5(email.trim().toLowerCase());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    const newErrors: Record<string, string> = {};

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      newErrors.name = 'Full display name is required';
    }

    if (!trimmedEmail) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    try {
      setIsSaving(true);
      await onUpdate({
        name: trimmedName,
        email: trimmedEmail,
        avatarUrl: previewAvatarUrl,
      });
      toast.success('Profile updated successfully');
      setFieldErrors({});
      setGeneralError(null);
      onOpenChange(false);
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      if (parsed.is422) {
        if (Object.keys(parsed.fieldErrors).length > 0) {
          setFieldErrors(parsed.fieldErrors);
          if (parsed.message && !Object.values(parsed.fieldErrors).includes(parsed.message)) {
            setGeneralError(parsed.message);
          }
        } else {
          setGeneralError(parsed.message || 'Validation failed');
        }
      } else {
        setGeneralError(parsed.message || 'Failed to update profile');
        toast.error(parsed.message || 'Failed to update profile');
      }
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
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Edit Account Profile
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update your display name and email address. The avatar is updated deterministically.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {generalError && (
              <div role="alert" className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-md">
                {generalError}
              </div>
            )}

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
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="e.g. Administrator"
                disabled={isSaving}
                error={!!fieldErrors.name}
                className="text-xs h-9"
                autoFocus
              />
              <FieldError error={fieldErrors.name} />
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                placeholder="admin@gettako.dev"
                disabled={isSaving}
                error={!!fieldErrors.email}
                className="text-xs h-9 font-mono"
              />
              <FieldError error={fieldErrors.email} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="text-sm h-9 active:not-aria-[haspopup]:translate-y-px"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || !name.trim() || !email.trim()}
              className="text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 h-9 active:not-aria-[haspopup]:translate-y-px"
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
