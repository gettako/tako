"use client";

import { Fingerprint, Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { login, loginWithPasskey } from "@/lib/api/auth";
import { parseApiError } from "@/lib/form-errors";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);

  function validateClient(): Record<string, string> {
    const errors: Record<string, string> = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address";
    }

    if (!password) {
      errors.password = "Password is required";
    }

    return errors;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const clientErrors = validateClient();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setGeneralError(null);
      return;
    }

    setPending(true);
    setGeneralError(null);
    setFieldErrors({});

    try {
      await login(email, password);
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const parsed = parseApiError(err);

      if (parsed.is422) {
        if (Object.keys(parsed.fieldErrors).length > 0) {
          setFieldErrors(parsed.fieldErrors);
          if (parsed.message && !Object.values(parsed.fieldErrors).includes(parsed.message)) {
            setGeneralError(parsed.message);
          }
        } else {
          const msgLower = (parsed.message || "").toLowerCase();
          if (msgLower.includes("email") && !msgLower.includes("password")) {
            setFieldErrors({ email: parsed.message });
          } else if (msgLower.includes("password") && !msgLower.includes("email")) {
            setFieldErrors({ password: parsed.message });
          } else {
            setGeneralError(parsed.message || "Validation failed.");
          }
        }
      } else {
        setGeneralError(parsed.message || "Invalid email or password.");
      }
      setPending(false);
    }
  }

  async function onPasskeyLogin() {
    setPasskeyPending(true);
    setGeneralError(null);
    setFieldErrors({});
    try {
      await loginWithPasskey();
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setGeneralError(parsed.message || "Failed to authenticate with passkey.");
      setPasskeyPending(false);
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={onSubmit}
      noValidate
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">Sign in</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Sign in to your Tako console.
          </p>
        </div>

        {generalError ? (
          <p role="alert" className="text-sm font-medium text-status-danger text-center animate-in fade-in-50">
            {generalError}
          </p>
        ) : null}

        <Field data-invalid={!!fieldErrors.email}>
          <FieldLabel htmlFor="email" className="text-xs font-semibold text-foreground">
            Email
          </FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="owner@tako.local"
            autoComplete="username"
            value={email}
            error={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.email;
                  return next;
                });
              }
              if (generalError) setGeneralError(null);
            }}
            className="h-9 text-xs sm:text-sm font-mono"
          />
          <FieldError id="email-error">{fieldErrors.email}</FieldError>
        </Field>

        <Field data-invalid={!!fieldErrors.password}>
          <div className="flex items-center">
            <FieldLabel htmlFor="password" className="text-xs font-semibold text-foreground">
              Password
            </FieldLabel>
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
            value={password}
            error={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) {
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.password;
                  return next;
                });
              }
              if (generalError) setGeneralError(null);
            }}
            className="h-9 text-xs sm:text-sm"
          />
          <FieldError id="password-error">{fieldErrors.password}</FieldError>
        </Field>

        <Field>
          <Button
            type="submit"
            className="w-full gap-2 cursor-pointer active:not-aria-[haspopup]:translate-y-px"
            disabled={pending || passkeyPending}
          >
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
