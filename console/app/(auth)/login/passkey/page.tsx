"use client";

import { useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginWithPasskey } from "@/lib/api/auth";

export default function PasskeyPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePasskeyLogin() {
    setPending(true);
    setError(null);
    try {
      await loginWithPasskey();
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : "Failed to sign in with passkey.");
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-xl font-bold font-sans">Sign in with a passkey</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Your browser will ask for your device unlock. Nothing leaves this device.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <p role="alert" className="text-xs font-medium text-status-danger text-center">
                {error}
              </p>
            ) : null}
            <div className="w-full flex justify-center">
              <Button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={pending}
                className="w-full gap-2 cursor-pointer active:not-aria-[haspopup]:translate-y-px"
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Verifying passkey…</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="size-4" />
                    <span>Use passkey</span>
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              No passkey prompt? Your browser may not support WebAuthn.{" "}
              <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
                Sign in with password instead
              </Link>
              .
            </p>
            <Link
              href="/login"
              className="block text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
