'use client';

import React, { useState } from 'react';
import { User } from '@/lib/types';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Mail, Shield, Save, Loader2, Sparkles, Hash, Calendar } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { getUserAvatarUrl, md5 } from '@/lib/avatar';
import { toast } from 'sonner';

interface ProfileInfoFormProps {
  user: User;
  onUpdate: (data: Partial<User>) => Promise<void>;
}

export function ProfileInfoForm({ user, onUpdate }: ProfileInfoFormProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = name !== user.name || email !== user.email;
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
    <Card className="border-border bg-card p-6">
      <CardHeader className="px-0 pt-0 pb-5">
        <SectionHeader
          icon={UserIcon}
          title="Personal Profile & Identity"
          description="Manage your account operator name, email address, and deterministic avatar."
        />
      </CardHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <CardContent className="px-0 space-y-6">
          {/* Avatar Preview & Seed Metadata Card */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-muted/20">
            <div className="flex items-center gap-4">
              <Avatar className="size-16 rounded-full border border-border ring-2 ring-primary/20 shrink-0 bg-background">
                <AvatarImage src={previewAvatarUrl} alt={name} className="rounded-full object-cover" />
                <AvatarFallback className="rounded-full text-base font-semibold bg-primary/10 text-primary">
                  {getInitials(name)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{name || 'Administrator'}</span>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] uppercase border-primary/40 bg-primary/10 text-primary px-2 py-0.5"
                  >
                    <Shield className="size-3 mr-1" />
                    {user.role}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
                  <Mail className="size-3" />
                  {email}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1 text-[11px] text-muted-foreground border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 font-mono">
                <Sparkles className="size-3 text-primary" />
                <span>Dicebear Big-Smile</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/80">
                <Hash className="size-2.5" />
                <span className="truncate max-w-[140px]" title={`Seed: ${emailHash}`}>
                  seed: {emailHash.slice(0, 10)}...
                </span>
              </div>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Display Name */}
            <div className="space-y-2">
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
              />
              <p className="text-[11px] text-muted-foreground">
                Your human-readable name shown in audit logs and deployments.
              </p>
            </div>

            {/* Email Address */}
            <div className="space-y-2">
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
              <p className="text-[11px] text-muted-foreground">
                Used for sign-in and deterministic avatar seed.
              </p>
            </div>
          </div>

          {/* System Identifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-lg border border-border/70 bg-muted/10 text-xs">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Hash className="size-3 text-muted-foreground/70" />
                Operator Identifier
              </span>
              <span className="font-mono text-xs font-medium text-foreground">{user.id}</span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3 text-muted-foreground/70" />
                Registered Since
              </span>
              <span className="font-mono text-xs text-foreground">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Active Operator'}
              </span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="px-0 pt-4 pb-0 flex items-center justify-between border-t border-border">
          <span className="text-[11px] text-muted-foreground">
            {isDirty ? 'Unsaved changes pending' : 'Profile up to date'}
          </span>

          <Button
            type="submit"
            size="sm"
            disabled={!isDirty || isSaving}
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
        </CardFooter>
      </form>
    </Card>
  );
}
