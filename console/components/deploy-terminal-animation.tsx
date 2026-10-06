"use client";

import { useEffect, useRef, useState } from "react";
import { Check, RotateCw } from "lucide-react";
import { cn } from "cn";

interface LogStep {
  text: string;
  type: "command" | "info" | "step" | "success" | "accent";
  delay: number;
}

const DEPLOY_STEPS: LogStep[] = [
  { text: "tako deploy --project prod --service web", type: "command", delay: 800 },
  { text: "Cloning repository at main (commit a83f210)", type: "info", delay: 600 },
  { text: "Detected app service, using Dockerfile", type: "info", delay: 400 },
  { text: "Building image tako/web:a83f210", type: "info", delay: 500 },
  { text: "Step 1/6: FROM node:22-alpine", type: "step", delay: 350 },
  { text: "Step 2/6: COPY package.json bun.lock ./", type: "step", delay: 350 },
  { text: "Step 3/6: RUN bun install --frozen-lockfile", type: "step", delay: 500 },
  { text: "Step 4/6: COPY . .", type: "step", delay: 350 },
  { text: "Step 5/6: RUN bun run build", type: "step", delay: 700 },
  { text: "Step 6/6: Exporting image layers", type: "step", delay: 450 },
  { text: "Pushing image to node-a via mTLS session", type: "info", delay: 550 },
  { text: "Recreating container web-app-1", type: "info", delay: 400 },
  { text: "Traefik v3: Configuring route https://app.gettako.dev", type: "accent", delay: 500 },
  { text: "Waiting for health check on port :3000...", type: "info", delay: 600 },
  { text: "✓ Health check passed (HTTP 200 OK)", type: "success", delay: 400 },
  { text: "✓ Deploy finished in 38s · Traffic serving 100%", type: "success", delay: 300 },
];

export function DeployTerminalAnimation({ className }: { className?: string }) {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [typedCommand, setTypedCommand] = useState("");
  const [isTypingCommand, setIsTypingCommand] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const terminalBodyRef = useRef<HTMLDivElement>(null);

  // Typing effect for the initial command
  useEffect(() => {
    const fullCommand = DEPLOY_STEPS[0].text;
    let charIndex = 0;
    setIsTypingCommand(true);
    setTypedCommand("");
    setCurrentLineIndex(0);
    setIsComplete(false);

    const typeTimer = setInterval(() => {
      charIndex++;
      setTypedCommand(fullCommand.slice(0, charIndex));
      if (charIndex >= fullCommand.length) {
        clearInterval(typeTimer);
        setIsTypingCommand(false);
        setCurrentLineIndex(1);
      }
    }, 38);

    return () => clearInterval(typeTimer);
  }, []);

  // Line-by-line progression
  useEffect(() => {
    if (isTypingCommand || currentLineIndex === 0) return;

    if (currentLineIndex < DEPLOY_STEPS.length) {
      const nextStep = DEPLOY_STEPS[currentLineIndex];
      const timer = setTimeout(() => {
        setCurrentLineIndex((prev) => prev + 1);
      }, nextStep.delay);

      return () => clearTimeout(timer);
    } else {
      setIsComplete(true);
      const loopTimer = setTimeout(() => {
        restart();
      }, 7000);

      return () => clearTimeout(loopTimer);
    }
  }, [currentLineIndex, isTypingCommand]);

  // Scroll to bottom on each line change
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [currentLineIndex, typedCommand]);

  function restart() {
    const fullCommand = DEPLOY_STEPS[0].text;
    let charIndex = 0;
    setIsComplete(false);
    setIsTypingCommand(true);
    setTypedCommand("");
    setCurrentLineIndex(0);

    const typeTimer = setInterval(() => {
      charIndex++;
      setTypedCommand(fullCommand.slice(0, charIndex));
      if (charIndex >= fullCommand.length) {
        clearInterval(typeTimer);
        setIsTypingCommand(false);
        setCurrentLineIndex(1);
      }
    }, 35);
  }

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-border bg-background font-mono text-xs shadow-xl transition-colors",
        className
      )}
    >
      {/* Terminal Titlebar */}
      <div className="flex h-9 select-none items-center justify-between border-b border-border bg-muted/60 px-4 transition-colors">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="size-2.5 rounded-full bg-red-500/80 transition-opacity hover:opacity-100" />
            <div className="size-2.5 rounded-full bg-yellow-500/80 transition-opacity hover:opacity-100" />
            <div className="size-2.5 rounded-full bg-green-500/80 transition-opacity hover:opacity-100" />
          </div>
          <span className="ml-2 text-[11px] text-muted-foreground">tako@console: ~/projects/web</span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
              isComplete
                ? "bg-status-success/10 text-status-success border border-status-success/20"
                : "bg-status-warning/10 text-status-warning border border-status-warning/20"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                isComplete ? "bg-status-success" : "animate-pulse bg-status-warning"
              )}
            />
            <span>{isComplete ? "HEALTHY" : "DEPLOYING"}</span>
          </div>

          <button
            type="button"
            onClick={restart}
            title="Replay deployment animation"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <RotateCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Body with strict fixed height and canvas background */}
      <div
        ref={terminalBodyRef}
        className="flex h-[245px] shrink-0 flex-col gap-1.5 overflow-y-auto bg-card/60 dark:bg-[#0A0C16] p-4 text-foreground/90 transition-colors scrollbar-none"
      >
        {/* Command Line */}
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <span className="text-primary font-bold select-none">$</span>
          <span>{typedCommand}</span>
          {isTypingCommand ? (
            <span className="inline-block h-3.5 w-1.5 animate-pulse bg-primary" />
          ) : null}
        </div>

        {/* Streamed Log Lines */}
        {DEPLOY_STEPS.slice(1, currentLineIndex).map((step, idx) => {
          if (step.type === "success") {
            return (
              <div key={idx} className="flex items-center gap-2 font-medium text-status-success">
                <Check className="size-3.5 shrink-0" />
                <span>{step.text.replace(/^✓\s*/, "")}</span>
              </div>
            );
          }

          if (step.type === "accent") {
            return (
              <div key={idx} className="text-primary font-medium">
                <span className="text-muted-foreground select-none">&rarr; </span>
                {step.text}
              </div>
            );
          }

          if (step.type === "step") {
            return (
              <div key={idx} className="pl-3 text-muted-foreground">
                <span className="text-muted-foreground/70 select-none">&bull; </span>
                {step.text}
              </div>
            );
          }

          return (
            <div key={idx} className="text-foreground/85">
              <span className="text-muted-foreground select-none">[info] </span>
              {step.text}
            </div>
          );
        })}

        {/* Active Cursor when deploying */}
        {!isTypingCommand && !isComplete && (
          <div className="flex items-center gap-1.5 pt-1 text-muted-foreground">
            <span className="inline-block size-1.5 animate-ping rounded-full bg-primary" />
            <span className="text-[11px]">executing pipeline...</span>
          </div>
        )}
      </div>

      {/* Terminal Footer Bar */}
      <div className="flex items-center justify-between border-t border-border/80 bg-muted/40 px-4 py-1.5 text-[11px] text-muted-foreground transition-colors">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">Target:</span>
          <span>node-a &bull; Traefik v3</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-status-success" />
          <span className="text-foreground">mTLS connected</span>
        </div>
      </div>
    </div>
  );
}
