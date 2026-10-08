"use client";

import { Fingerprint, Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { login, loginWithPasskey } from "@/lib/api/auth";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email, password);
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : "Invalid email or password.");
      setPending(false);
    }
  }

  async function onPasskeyLogin() {
    setPasskeyPending(true);
    setError(null);
    try {
      await loginWithPasskey();
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : "Failed to authenticate with passkey.");
      setPasskeyPending(false);
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={onSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Sign in</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Sign in to your Tako console.
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-sm font-medium text-status-danger text-center">
            {error}
          </p>
        ) : null}

        <Field>
          <FieldLabel htmlFor="email" className="text-xs font-semibold text-foreground">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="owner@tako.local"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 text-xs sm:text-sm font-mono"
          />
        </Field>

        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password" className="text-xs font-semibold text-foreground">Password</FieldLabel>
            <Link
              href="/login/2fa"
              className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-9 text-xs sm:text-sm"
          />
        </Field>

        <Field>
          <Button type="submit" className="w-full gap-2 cursor-pointer active:not-aria-[haspopup]:translate-y-px" disabled={pending || passkeyPending}>
            <LogIn className="size-4" />
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </Field>

        <FieldSeparator>Or continue with</FieldSeparator>

        <Field>
          <Button
            type="button"
            variant="outline"
            onClick={onPasskeyLogin}
            disabled={pending || passkeyPending}
            className="w-full gap-2 cursor-pointer text-xs sm:text-sm active:not-aria-[haspopup]:translate-y-px"
          >
            {passkeyPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Verifying passkey…</span>
              </>
            ) : (
              <>
                <Fingerprint className="size-4" />
                <span>Sign in with Passkey</span>
              </>
            )}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
