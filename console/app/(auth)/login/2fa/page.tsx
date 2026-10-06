import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const metadata: Metadata = {
  title: "Two-Factor Authentication",
};

export default function TwoFactorPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-xl font-bold font-sans">Two-factor code</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Enter the six-digit code from your authenticator app.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" action="/" method="get">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-xs font-semibold">Code</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className="font-mono tracking-[0.4em] text-center text-lg h-10"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="trust" name="trust" />
                <Label htmlFor="trust" className="text-xs font-normal text-muted-foreground cursor-pointer">
                  Trust this device for 30 days
                </Label>
              </div>
              <Button type="submit" className="w-full gap-2 cursor-pointer">
                <ShieldCheck className="size-4" />
                Verify
              </Button>
            </form>
            <div className="mt-4 flex justify-between text-xs">
              <Link href="/login/2fa?recovery=1" className="text-muted-foreground hover:text-foreground underline underline-offset-2">
                Use a recovery code
              </Link>
              <Link href="/login" className="text-muted-foreground hover:text-foreground underline underline-offset-2">
                Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
