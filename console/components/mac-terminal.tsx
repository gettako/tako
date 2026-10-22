"use client"

import * as React from "react"
import { TerminalIcon, RotateCcwIcon, CheckIcon } from "lucide-react"

interface TerminalLine {
  id: string
  text: string
  type: "command" | "header" | "step" | "detail" | "success" | "info" | "empty"
  prefix?: string
}

const BUILD_SEQUENCE: TerminalLine[] = [
  {
    id: "1",
    type: "command",
    text: "tako deploy --env production",
    prefix: "$",
  },
  {
    id: "2",
    type: "info",
    text: "⚡️ Tako Engine v2.4.0 — Target: production-cluster-sg1",
  },
  { id: "3", type: "empty", text: "" },
  {
    id: "4",
    type: "header",
    text: "[+] Building 4.2s (10/10) FINISHED               docker:desktop-linux",
  },
  {
    id: "5",
    type: "step",
    text: "=> [internal] load build definition from Dockerfile",
    prefix: "=>",
  },
  { id: "6", type: "detail", text: "=> => transferring dockerfile: 382B" },
  {
    id: "7",
    type: "step",
    text: "=> [internal] load metadata for docker.io/library/node:22-alpine",
    prefix: "=>",
  },
  {
    id: "8",
    type: "step",
    text: "=> [1/6] FROM docker.io/library/node:22-alpine@sha256:889417",
    prefix: "=>",
  },
  { id: "9", type: "step", text: "=> [2/6] WORKDIR /app", prefix: "=>" },
  {
    id: "10",
    type: "step",
    text: "=> [3/6] COPY package.json bun.lock ./",
    prefix: "=>",
  },
  {
    id: "11",
    type: "step",
    text: "=> [4/6] RUN bun install --frozen-lockfile",
    prefix: "=>",
  },
  {
    id: "12",
    type: "detail",
    text: "=> => resolved 420 dependencies in 380ms",
  },
  { id: "13", type: "step", text: "=> [5/6] COPY . .", prefix: "=>" },
  { id: "14", type: "step", text: "=> [6/6] RUN bun run build", prefix: "=>" },
  {
    id: "15",
    type: "detail",
    text: "=> => compiled Next.js bundle successfully (Turbopack: 210ms)",
  },
  { id: "16", type: "step", text: "=> exporting to image", prefix: "=>" },
  {
    id: "17",
    type: "detail",
    text: "=> => naming to registry.gettako.dev/apps/tako:v2.4.1",
  },
  {
    id: "18",
    type: "detail",
    text: "=> => pushing layer [========================================] 100%",
  },
  { id: "19", type: "empty", text: "" },
  {
    id: "20",
    type: "success",
    text: "Docker image built & pushed: registry.gettako.dev/apps/tako:v2.4.1",
  },
  {
    id: "21",
    type: "success",
    text: "Container deployed to Singapore edge node (healthy)",
  },
  {
    id: "22",
    type: "info",
    text: "🔗 Production URL: https://gettako.dev/dashboard",
  },
]

export function MacTerminal({ className = "" }: { className?: string }) {
  const [visibleLineCount, setVisibleLineCount] = React.useState<number>(0)
  const [typedCommand, setTypedCommand] = React.useState<string>("")
  const [isTyping, setIsTyping] = React.useState<boolean>(true)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const fullCommand = BUILD_SEQUENCE[0].text
  const isComplete = !isTyping && visibleLineCount >= BUILD_SEQUENCE.length

  // Reset and restart animation
  const restart = React.useCallback(() => {
    setVisibleLineCount(0)
    setTypedCommand("")
    setIsTyping(true)
  }, [])

  // Auto-typing animation for the first command
  React.useEffect(() => {
    if (!isTyping) return

    let charIndex = 0

    const typingInterval = setInterval(() => {
      charIndex++
      setTypedCommand(fullCommand.slice(0, charIndex))

      if (charIndex >= fullCommand.length) {
        clearInterval(typingInterval)
        setTimeout(() => {
          setIsTyping(false)
          setVisibleLineCount(1)
        }, 350)
      }
    }, 45)

    return () => clearInterval(typingInterval)
  }, [isTyping, fullCommand])

  // Step-by-step stream of build log output
  React.useEffect(() => {
    if (isTyping) return

    if (visibleLineCount < BUILD_SEQUENCE.length) {
      const line = BUILD_SEQUENCE[visibleLineCount]
      let delay = 140
      if (line.type === "header") delay = 350
      else if (line.text.includes("bun install")) delay = 450
      else if (line.text.includes("bun run build")) delay = 550
      else if (line.text.includes("pushing layer")) delay = 400
      else if (line.type === "success") delay = 300

      const timer = setTimeout(() => {
        setVisibleLineCount((prev) => prev + 1)
      }, delay)

      return () => clearTimeout(timer)
    }

    // Auto-restart after 6.5 seconds when finished
    const loopTimer = setTimeout(() => {
      restart()
    }, 6500)
    return () => clearTimeout(loopTimer)
  }, [isTyping, visibleLineCount, restart])

  // Scroll to bottom as lines appear
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [typedCommand, visibleLineCount])

  return (
    <div
      className={`flex h-[500px] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/95 font-mono shadow-2xl shadow-black/60 backdrop-blur-md ${className}`}
    >
      {/* macOS Window Title Bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-900/70 px-4 select-none">
        {/* Traffic Light Buttons */}
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-[#ff5f56] transition-opacity hover:opacity-80" />
          <span className="size-3 rounded-full bg-[#ffbd2e] transition-opacity hover:opacity-80" />
          <span className="size-3 rounded-full bg-[#27c93f] transition-opacity hover:opacity-80" />
        </div>

        {/* Window Title */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <TerminalIcon className="size-3.5 text-zinc-500" />
          <span className="font-sans font-medium text-zinc-300">
            tako deploy
          </span>
          <span className="text-zinc-600">: zsh</span>
        </div>

        {/* Action button */}
        <button
          type="button"
          onClick={restart}
          title="Restart animation"
          className="flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <RotateCcwIcon className="size-3" />
        </button>
      </div>

      {/* Terminal Content Area (Fixed Height with auto-scroll) */}
      <div
        ref={scrollRef}
        className="flex-1 scrollbar-thin scrollbar-thumb-zinc-800 overflow-y-auto p-4 text-xs leading-relaxed text-zinc-300 select-text"
      >
        {/* Command Line Prompt */}
        <div className="flex items-center gap-2 text-zinc-100">
          <span className="font-semibold text-emerald-400">tako@edge</span>
          <span className="text-zinc-500">:</span>
          <span className="text-cyan-400">~/app</span>
          <span className="text-zinc-400">$</span>
          <span>{typedCommand}</span>
          {isTyping && (
            <span className="inline-block h-4 w-2 animate-pulse bg-zinc-200 align-middle" />
          )}
        </div>

        {/* Streaming Build Output */}
        {!isTyping && (
          <div className="mt-2 space-y-1">
            {BUILD_SEQUENCE.slice(1, visibleLineCount).map((line) => {
              if (line.type === "empty") {
                return <div key={line.id} className="h-2" />
              }

              if (line.type === "header") {
                return (
                  <div key={line.id} className="font-semibold text-zinc-400">
                    {line.text}
                  </div>
                )
              }

              if (line.type === "step") {
                return (
                  <div key={line.id} className="flex gap-2 text-sky-400/90">
                    <span className="font-bold text-zinc-500">
                      {line.prefix}
                    </span>
                    <span className="text-zinc-300">
                      {line.text.replace(/^=>\s*/, "")}
                    </span>
                  </div>
                )
              }

              if (line.type === "detail") {
                return (
                  <div key={line.id} className="pl-6 text-zinc-500">
                    {line.text}
                  </div>
                )
              }

              if (line.type === "success") {
                return (
                  <div
                    key={line.id}
                    className="flex items-center gap-1.5 font-medium text-emerald-400"
                  >
                    <CheckIcon className="size-3.5 shrink-0 text-emerald-400" />
                    <span>{line.text}</span>
                  </div>
                )
              }

              if (line.type === "info") {
                return (
                  <div key={line.id} className="text-zinc-400">
                    {line.text}
                  </div>
                )
              }

              return (
                <div key={line.id} className="text-zinc-300">
                  {line.text}
                </div>
              )
            })}

            {/* Next prompt after completion */}
            {isComplete && (
              <div className="mt-3 flex items-center gap-2 border-t border-zinc-900 pt-2 text-zinc-100">
                <span className="font-semibold text-emerald-400">
                  tako@edge
                </span>
                <span className="text-zinc-500">:</span>
                <span className="text-cyan-400">~/app</span>
                <span className="text-zinc-400">$</span>
                <span className="inline-block h-4 w-2 animate-pulse bg-emerald-400 align-middle" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Terminal Status Bar */}
      <div className="flex h-7 shrink-0 items-center justify-between border-t border-zinc-800/80 bg-zinc-900/60 px-4 text-[11px] text-zinc-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full ${isComplete ? "animate-ping bg-emerald-500" : "animate-pulse bg-amber-400"}`}
            />
            <span className="font-sans text-zinc-400">
              {isTyping
                ? "typing..."
                : isComplete
                  ? "deploy complete"
                  : "building docker image..."}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3 font-sans">
          <span>UTF-8</span>
          <span>Docker Engine</span>
        </div>
      </div>
    </div>
  )
}
