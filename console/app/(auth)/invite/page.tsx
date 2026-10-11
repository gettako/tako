'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Server, Shield, User, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { BrandLockup } from '@/components/brand';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';

function InviteAcceptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteData, setInviteData] = useState<{ email: string; role: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setError('Missing invitation token in the link.');
      return;
    }

    async function verifyToken() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/auth/invite/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Invalid or expired invitation token.');
        } else {
          setInviteData({ email: data.email, role: data.role });
          setName(data.email.split('@')[0]);
        }
      } catch {
        setError('Unable to verify invitation. Please check your network connection.');
      } finally {
        setIsLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Please enter your full name');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/auth/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: name.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to accept invitation');
        return;
      }

      toast.success('Welcome to Tako! Your account is ready.');
      router.push('/dashboard');
    } catch {
      setFormError('Failed to communicate with authentication service');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8 text-center space-y-4">
        <Loader2 className="size-8 text-primary animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Verifying invitation link...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border bg-card p-6 space-y-4">
        <CardHeader className="px-0 pt-0 pb-2">
          <div className="size-10 rounded-full bg-status-danger/10 text-status-danger flex items-center justify-center mb-2">
            <AlertCircle className="size-5" />
          </div>
          <CardTitle className="text-lg font-bold">Invitation Error</CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            {error}
          </CardDescription>
        </CardHeader>
        <CardFooter className="px-0 pt-2">
          <Button
            variant="outline"
            className="w-full text-xs h-9 active:not-aria-[haspopup]:translate-y-px"
            render={<Link href="/login" />}
          >
            <span>Back to Sign In</span>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card p-6">
      <CardHeader className="px-0 pt-0 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl font-bold">Complete Setup</CardTitle>
            <Badge variant="outline" className="font-mono text-xs uppercase bg-primary/10 text-primary border-primary/30">
              {inviteData?.role || 'member'}
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Accept invitation for <span className="font-semibold text-foreground font-mono">{inviteData?.email}</span>
          </CardDescription>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {formError && (
          <div className="p-3 rounded-lg border border-status-danger/30 bg-status-danger/10 text-status-danger text-xs font-medium">
            {formError}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-medium">Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              className="pl-9 text-xs h-9"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium">New Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="pl-9 text-xs h-9 font-mono"
              required
              minLength={8}
            />
          </div>
          <span className="text-[11px] text-muted-foreground block">
            Must contain at least 8 characters
          </span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-xs font-medium">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="pl-9 text-xs h-9 font-mono"
              required
              minLength={8}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full text-xs h-9 font-medium gap-1.5 mt-2 active:not-aria-[haspopup]:translate-y-px"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Creating Account...</span>
            </>
          ) : (
            <>
              <span>Join Cluster</span>
              <ArrowRight className="size-3.5" />
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}

export default function InviteAcceptPage() {
  return (
    <main className="grid min-h-svh lg:grid-cols-2 bg-background text-foreground">
      {/* Left side: Platform Info */}
      <div className="relative hidden flex-col justify-between border-r border-border bg-muted/20 p-10 lg:flex dark:bg-[#090A12]">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrandLockup />
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-status-success" />
            <span className="font-mono">team invitation</span>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-xl flex-col gap-5 py-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
              <Server className="size-4" />
              <span>Cluster Onboarding</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground font-sans">
              Join your team on Takō Cloud Platform
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You have been granted access to deploy services, inspect telemetry, and collaborate on self-hosted infrastructure.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Shield className="size-4 text-primary" />
              <span>Role-Based Access Control Active</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your operator credentials grant encrypted access through the Takō control plane. Passkeys and 2FA can be configured in your profile settings after joining.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-status-success shrink-0" />
              <span>Direct Node Orchestration</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-status-success shrink-0" />
              <span>Encrypted mTLS</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-status-success shrink-0" />
              <span>Full Telemetry</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} tako</span>
          <span className="font-mono">Cluster Access &bull; RBAC</span>
        </div>
      </div>

      {/* Right side: Invitation Acceptance Form */}
      <div className="relative flex flex-col justify-between gap-4 p-6 md:p-10 bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <BrandLockup />
            </Link>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center my-auto">
          <div className="w-full max-w-sm">
            <Suspense
              fallback={
                <Card className="p-8 text-center space-y-4">
                  <Loader2 className="size-8 text-primary animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground">Loading invitation...</p>
                </Card>
              }
            >
              <InviteAcceptForm />
            </Suspense>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground lg:hidden pt-4 border-t border-border">
          <span>&copy; {new Date().getFullYear()} tako</span>
          <span className="font-mono">Cluster Access</span>
        </div>
      </div>
    </main>
  );
}
