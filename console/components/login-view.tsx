"use client"
import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { NetworkNodesAnimation } from "@/components/network-nodes"
import { ThemeToggle } from "@/components/theme-toggle"
import { siteConfig } from "@/config/site"
import { usePlatformData } from "@/context/platform-data-context"

export function LoginView() {
  const router = useRouter()
  const { status } = usePlatformData()

  React.useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard")
    }
  }, [status, router])

  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      {/* Top Header: Logo on the left, Theme Toggle on the right */}
      <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between px-6 lg:px-10">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-medium transition-opacity hover:opacity-85"
        >
          <Image
            src="/images/octopy-trim.png"
            alt={siteConfig.name}
            width={32}
            height={32}
            className="size-8 rounded-lg object-contain"
            priority
          />
          <span className="text-base font-semibold tracking-tight text-foreground">
            {siteConfig.name}
          </span>
        </Link>

        <ThemeToggle />
      </header>

      {/* Main Content Layout - 12-col grid prioritizing expansive left-side edge map */}
      <div className="grid flex-1 pt-16 lg:grid-cols-12 lg:pt-0">
        {/* Left Column: Global Edge Network Visualization (Full, large map) */}
        <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border/70 bg-background p-4 pt-20 sm:p-6 lg:col-span-7 lg:flex lg:p-6 xl:col-span-7 xl:p-8 xl:pt-20">
          {/* Subtle ambient radial gradient behind the network canvas */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08),transparent_70%)]" />

          {/* Network Canvas Container - Spans full width and height */}
          <div className="relative z-10 flex size-full flex-1 flex-col justify-between">
            <NetworkNodesAnimation className="size-full" />
          </div>
        </div>

        {/* Right Column: Login Form */}
        <div className="flex flex-col justify-between p-6 sm:p-10 lg:col-span-5 lg:p-10 xl:col-span-5 xl:p-12">
          {/* Spacer for top header clearance */}
          <div className="h-4 lg:h-8" />

          {/* Centered Login Form */}
          <div className="flex flex-1 items-center justify-center py-6">
            <div className="w-full max-w-sm">
              <LoginForm />
            </div>
          </div>

          {/* Footer info */}
          <div className="text-center text-xs text-muted-foreground">
            By clicking continue, you agree to our{" "}
            <button
              type="button"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Terms of Service
            </button>{" "}
            and{" "}
            <button
              type="button"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Privacy Policy
            </button>
            .
          </div>
        </div>
      </div>
    </div>
  )
}
