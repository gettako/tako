import type { Metadata } from "next";
import Link from "next/link";
import { Check, Server } from "lucide-react";

import { BrandLockup } from "@/components/brand";
import { DeployTerminalAnimation } from "@/components/deploy-terminal-animation";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Takō Cloud Console",
};

export default function LoginPage() {
  return (
    <main className="grid min-h-svh lg:grid-cols-2 bg-background text-foreground">
      {/* Left side: Terminal Deploy Animation & Showcase */}
      <div className="relative hidden flex-col justify-between border-r border-border bg-muted/20 p-10 lg:flex dark:bg-[#090A12]">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrandLockup />
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-status-success" />
            <span className="font-mono">tako console</span>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-xl flex-col gap-5 py-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary">
              <Server className="size-4" />
              <span>Self-Hosted Platform</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground font-sans">
              Deploy and manage apps on servers you own
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Central control plane and web UI; lightweight agents manage your nodes with outbound-only mTLS.
            </p>
          </div>

          {/* Animated Deploy Terminal */}
          <DeployTerminalAnimation />

          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-status-success shrink-0" />
              <span>Outbound mTLS agents</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-status-success shrink-0" />
              <span>Zero-downtime Traefik v3 routing</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-status-success shrink-0" />
              <span>Stateless nodes</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} tako</span>
          <span className="font-mono">mTLS &bull; Traefik v3</span>
        </div>
      </div>

      {/* Right side: Login Form */}
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
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground lg:hidden pt-4 border-t border-border">
          <span>&copy; {new Date().getFullYear()} tako</span>
          <span className="font-mono">mTLS &bull; Traefik v3</span>
        </div>
      </div>
    </main>
  );
}
