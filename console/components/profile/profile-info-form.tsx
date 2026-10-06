'use client';

import React, { useState } from 'react';
import { User } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Mail, Shield, Save, Loader2 } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    try {
      setIsSaving(true);
      await onUpdate({ name: name.trim(), email: email.trim() });
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (n: string) => {
    return n
      .split(' ')
      .map((i) => i[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="border-border bg-card p-6">
      <CardHeader className="px-0 pt-0 pb-4">
        <SectionHeader
          icon={UserIcon}
          title="Personal Information"
          description="Update your public profile display name, email address, and view your role permissions."
        />
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="px-0 space-y-5">
          {/* Avatar & Role Header */}
          <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/20">
            <Avatar className="size-12">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback className="text-sm font-semibold">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">{user.name}</span>
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] uppercase border-primary/40 bg-primary/10 text-primary"
                >
                  {user.role}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <UserIcon className="size-3.5 text-muted-foreground" />
                Full Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                disabled={isSaving}
                className="text-xs"
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
                placeholder="you@company.com"
                disabled={isSaving}
                className="text-xs"
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="px-0 pt-4 pb-0 flex justify-end border-t border-border">
          <Button
            type="submit"
            size="sm"
            disabled={!isDirty || isSaving}
            className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5"
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
