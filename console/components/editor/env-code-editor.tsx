"use client"

import * as React from "react"
import Prism from "prismjs"
import { CopyIcon, CheckIcon, FileTextIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { cn } from "@/lib/utils"

// Initialize Dotenv Grammar for Prism
if (!Prism.languages.dotenv) {
  Prism.languages.dotenv = {
    comment: {
      pattern: /(^#|[\s]+#).*/m,
      greedy: true,
    },
    variable: {
      pattern: /^[A-Za-z_][A-Za-z0-9_]*(?=\s*=)/m,
      greedy: true,
    },
    operator: /=/,
    string: {
      pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
      greedy: true,
    },
    boolean: /\b(?:true|false)\b/i,
    number: /\b\d+(?:\.\d+)?\b/,
  }
}

export interface EnvCodeEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  ariaLabel?: string
  className?: string
  readOnly?: boolean
}

export function EnvCodeEditor({
  value,
  onChange,
  placeholder = "DATABASE_URL=postgres://...\nAPI_SECRET=sk_live_...",
  rows = 8,
  ariaLabel = "Environment variables editor",
  className,
  readOnly = false,
}: EnvCodeEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const preRef = React.useRef<HTMLPreElement>(null)
  const { copy: copyEnv, isCopied: copied } = useCopyToClipboard(2000)

  // Compute line count
  const lines = React.useMemo(() => {
    return value.split("\n")
  }, [value])

  const lineCount = Math.max(lines.length, rows)

  // Highlighted HTML string from Prism
  const highlightedHtml = React.useMemo(() => {
    if (!value) return ""
    return Prism.highlight(value, Prism.languages.dotenv, "dotenv")
  }, [value])

  // Synchronize scrolling between textarea and pre
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop
      preRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  const handleCopy = async () => {
    if (!value) return
    await copyEnv(value)
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-md border border-border bg-card text-foreground transition-colors focus-within:has-[:focus-visible]:border-ring focus-within:has-[:focus-visible]:ring-2 focus-within:has-[:focus-visible]:ring-ring focus-within:has-[:focus-visible]:ring-offset-2 focus-within:has-[:focus-visible]:ring-offset-background",
        className
      )}
    >
      {/* Editor Header Bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5 text-xs select-none">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileTextIcon className="size-3.5" aria-hidden="true" />
          <span className="font-mono text-2xs font-medium text-foreground">
            .env syntax
          </span>
          <span className="text-muted-foreground/60">•</span>
          <span className="font-mono text-2xs">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleCopy}
            disabled={!value}
            className="h-6 cursor-pointer gap-1 px-2 text-2xs text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <>
                <CheckIcon className="size-3 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">
                  Copied
                </span>
              </>
            ) : (
              <>
                <CopyIcon className="size-3" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Editor Body with Line Numbers & Layered Highlight */}
      <div className="relative flex flex-1 overflow-hidden font-mono text-xs leading-5">
        {/* Line Numbers Gutter */}
        <div
          aria-hidden="true"
          className="shrink-0 border-r border-border bg-muted/20 px-2.5 py-3 text-right font-mono text-2xs text-muted-foreground/50 select-none"
        >
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i} className="h-5">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code Canvas Container */}
        <div className="relative min-w-0 flex-1">
          {/* Syntax Highlighted Layer (Beneath) */}
          <pre
            ref={preRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-0 overflow-hidden bg-transparent p-3 font-mono text-xs leading-5 break-all whitespace-pre-wrap [tab-size:2] select-none"
          >
            {value ? (
              <code
                className="env-tokens font-mono text-xs leading-5 [tab-size:2]"
                dangerouslySetInnerHTML={{
                  __html: highlightedHtml + (value.endsWith("\n") ? " " : ""),
                }}
              />
            ) : (
              <span className="text-muted-foreground/50 italic">
                {placeholder}
              </span>
            )}
          </pre>

          {/* Editable Textarea Layer (On Top) */}
          <textarea
            ref={textareaRef}
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            readOnly={readOnly}
            placeholder={placeholder}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="relative z-10 min-h-35 w-full resize-y overflow-auto bg-transparent p-3 font-mono text-xs leading-5 break-all whitespace-pre-wrap [tab-size:2] text-transparent caret-foreground selection:bg-primary/20 selection:text-transparent focus:outline-none"
            aria-label={ariaLabel}
          />
        </div>
      </div>

      <style jsx global>{`
        .env-tokens .token.variable {
          color: #0284c7;
          font-weight: 600;
        }
        :global(.dark) .env-tokens .token.variable {
          color: #38bdf8;
          font-weight: 600;
        }
        .env-tokens .token.operator {
          color: #71717a;
        }
        :global(.dark) .env-tokens .token.operator {
          color: #a1a1aa;
        }
        .env-tokens .token.string {
          color: #15803d;
        }
        :global(.dark) .env-tokens .token.string {
          color: #4ade80;
        }
        .env-tokens .token.boolean {
          color: #7c3aed;
        }
        :global(.dark) .env-tokens .token.boolean {
          color: #c084fc;
        }
        .env-tokens .token.number {
          color: #b45309;
        }
        :global(.dark) .env-tokens .token.number {
          color: #fbbf24;
        }
        .env-tokens .token.comment {
          color: #71717a;
          font-style: italic;
        }
        :global(.dark) .env-tokens .token.comment {
          color: #71717a;
          font-style: italic;
        }
      `}</style>
    </div>
  )
}
