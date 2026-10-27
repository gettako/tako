"use client"

import * as React from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { Radio, RefreshCw } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { siteConfig } from "@/config/site"
import { DEFAULT_PORTS } from "@/lib/api"
import { cn } from "@/lib/utils"

const CONNECTION_STAGES = [
  "Establishing secure mTLS session...",
  "Negotiating control plane handshake...",
  "Synchronizing edge telemetry stream...",
  "Verifying cluster credentials...",
]

export interface ControlPlaneLoadingProps {
  initialElapsed?: number
  forceShowTimeout?: boolean
  framelessCard?: boolean
}

export function ControlPlaneLoading({
  initialElapsed = 0,
  forceShowTimeout = false,
  framelessCard = false,
}: ControlPlaneLoadingProps = {}) {
  const [stageIndex, setStageIndex] = React.useState(0)
  const [elapsedSeconds, setElapsedSeconds] = React.useState(initialElapsed)

  // Cycle through technical connection stages to provide reassuring liveliness
  React.useEffect(() => {
    const stageTimer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % CONNECTION_STAGES.length)
    }, 2400)

    const elapsedTimer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    return () => {
      clearInterval(stageTimer)
      clearInterval(elapsedTimer)
    }
  }, [])

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background p-4 text-foreground select-none">
      {/* Semantic screen-reader announcement */}
      <output className="sr-only" aria-live="polite">
        Connecting to control plane. {CONNECTION_STAGES[stageIndex]}
      </output>

      {/* Subtle ambient radial light centered on the viewport */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,85,46,0.08),transparent_70%)] dark:bg-[radial-gradient(circle,rgba(255,85,46,0.09),transparent_70%)]"
        aria-hidden="true"
      />

      {/* Subtle Theme Toggle at top-right corner */}
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      {/* Central Interactive Loading Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={cn(
          "relative z-10 flex w-full max-w-sm flex-col items-center p-8 text-center sm:max-w-md",
          !framelessCard &&
            "rounded-xl border border-border/70 bg-card/70 shadow-xs backdrop-blur-xs"
        )}
      >
        {/* Logo with Concentric Circular Radar Beacon (Without Box) */}
        <div className="relative flex size-24 items-center justify-center">
          {/* Outer radar ping ring */}
          <span
            className="absolute size-20 animate-ping rounded-full border border-primary/25 [animation-duration:3s]"
            aria-hidden="true"
          />
          {/* Middle pulse perimeter ring */}
          <span
            className="absolute size-24 animate-pulse rounded-full border border-primary/15"
            aria-hidden="true"
          />

          {/* Center Logo directly without box */}
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
            className="relative flex items-center justify-center"
          >
            <Image
              src="/images/tako-trim.png"
              alt={siteConfig.name}
              width={48}
              height={48}
              className="size-12 object-contain"
              priority
            />
          </motion.div>
        </div>

        {/* Heading */}
        <h1 className="mt-6 text-base font-semibold tracking-tight text-foreground">
          Connecting to control plane
        </h1>

        {/* Stage Subtitle with Smooth Animated Crossfade */}
        <div className="mt-1.5 flex h-5 items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={stageIndex}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.18 }}
              className="font-mono text-xs text-muted-foreground"
            >
              {CONNECTION_STAGES[stageIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* High-Precision Progress Track with Fluid Coral Beam */}
        <div
          className="relative mt-5 h-1 w-52 overflow-hidden rounded-full bg-muted/80"
          aria-hidden="true"
        >
          <motion.div
            className="h-full w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent"
            animate={{
              x: ["-100%", "220%"],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.8,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* Telemetry Link Specs Pill */}
        <div className="mt-6 flex items-center justify-center gap-3 rounded-lg border border-border/80 bg-muted/20 px-3.5 py-1.5 font-mono text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Radio
              className="size-3 animate-pulse text-primary"
              aria-hidden="true"
            />
            <span className="font-medium text-foreground">mTLS</span>
          </div>
          <span className="text-border" aria-hidden="true">
            /
          </span>
          <span>PORT {DEFAULT_PORTS.HTTP}</span>
          <span className="text-border" aria-hidden="true">
            /
          </span>
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span className="font-medium text-emerald-500">HANDSHAKE</span>
          </div>
        </div>

        {/* Long Wait Reassurance Notice (Displays if connection takes > 10s or forced) */}
        {(forceShowTimeout || elapsedSeconds >= 10) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-6 border-t border-border/50 pt-4 text-center text-xs text-muted-foreground"
          >
            <p>Handshake taking longer than usual?</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/75">
              Check that your Tako daemon is running and network ports are
              accessible.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              <RefreshCw
                className="size-3 text-muted-foreground"
                aria-hidden="true"
              />
              Retry connection
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
