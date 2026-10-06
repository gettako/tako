import type { Metadata } from "next";
import { Fingerprint } from "lucide-react";
import Link from "next/link";

import { MockAction } from "@/components/mock-action";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Passkey Sign In",
};

export default function PasskeyPage() {
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
            <div className="w-full flex justify-center">
              <MockAction
                label="Use passkey"
                icon={<Fingerprint className="size-4 mr-2" />}
                message="The browser WebAuthn prompt is UI-only in this prototype."
              />
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
