"use client"

import * as React from "react"
import Prism from "prismjs"
import {
  CopyIcon,
  CheckIcon,
  FileCodeIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { cn } from "@/lib/utils"

// Initialize YAML Grammar for Prism
if (!Prism.languages.yaml) {
  Prism.languages.yaml = {
    comment: {
      pattern: /(^|[\s]+)#.*/,
      lookbehind: true,
      greedy: true,
    },
    string: {
      pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
      greedy: true,
    },
    key: {
      pattern: /(^\s*)[a-zA-Z0-9_-]+(?=\s*:)/m,
      lookbehind: true,
      alias: "attr-name",
    },
    boolean: /\b(?:true|false|yes|no)\b/i,
    number: /\b\d+(?:\.\d+)?\b/,
    punctuation: /[:-]/,
  }
}

export interface YamlValidationError {
  line: number
  message: string
}

export function validateYamlClientSide(yaml: string): YamlValidationError[] {
  const errors: YamlValidationError[] = []
  const lines = yaml.split("\n")

  lines.forEach((line, index) => {
    const lineNum = index + 1
    // Check for tab indentation (YAML strictly forbids tabs)
    if (line.match(/^\t+/)) {
      errors.push({
        line: lineNum,
        message: `Line ${lineNum} uses tab indentation: YAML requires spaces.`,
      })
    }

    // Check for unclosed single quotes
    const singleQuotes = (line.match(/'/g) || []).length
    if (singleQuotes % 2 !== 0 && !line.trim().startsWith("#")) {
      errors.push({
        line: lineNum,
        message: `Line ${lineNum} has unclosed single quote.`,
      })
    }

    // Check for unclosed double quotes
    const doubleQuotes = (line.match(/"/g) || []).length
    if (doubleQuotes % 2 !== 0 && !line.trim().startsWith("#")) {
      errors.push({
        line: lineNum,
        message: `Line ${lineNum} has unclosed double quote.`,
      })
    }
  })

  return errors
}

export interface YamlCodeEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  ariaLabel?: string
  className?: string
  readOnly?: boolean
  validationErrors?: YamlValidationError[]
}

export function YamlCodeEditor({
  value,
  onChange,
  placeholder = "http:\n  middlewares:\n    my-filter:\n      headers:\n        sslRedirect: true\n",
  rows = 12,
  ariaLabel = "YAML code editor",
  className,
  readOnly = false,
  validationErrors,
}: YamlCodeEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const preRef = React.useRef<HTMLPreElement>(null)
  const { copy: copyYaml, isCopied: copied, error } = useCopyToClipboard(2000)

  const lines = React.useMemo(() => {
    return value.split("\n")
  }, [value])

  const lineCount = Math.max(lines.length, rows)

  const highlightedHtml = React.useMemo(() => {
    if (!value) return ""
    return Prism.highlight(value, Prism.languages.yaml, "yaml")
  }, [value])

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop
      preRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  const handleCopy = async () => {
    if (!value) return
    await copyYaml(value)
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-md border border-border bg-card text-foreground transition-colors focus-within:has-[:focus-visible]:border-ring focus-within:has-[:focus-visible]:ring-2 focus-within:has-[:focus-visible]:ring-ring focus-within:has-[:focus-visible]:ring-offset-2 focus-within:has-[:focus-visible]:ring-offset-background",
        className
      )}
    >
      {/* Editor Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5 text-xs select-none">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileCodeIcon className="size-3.5" aria-hidden="true" />
          <span className="font-mono text-2xs font-medium text-foreground">
            YAML syntax
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
            <span className="sr-only" aria-live="polite">
              {copied ? "YAML copied to clipboard" : error || ""}
            </span>
          </Button>
        </div>
      </div>

      {/* Editor Canvas */}
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

        {/* Code Area */}
        <div className="relative min-w-0 flex-1">
          <pre
            ref={preRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-0 overflow-hidden bg-transparent p-3 font-mono text-xs leading-5 break-all whitespace-pre-wrap [tab-size:2] select-none"
          >
            {value ? (
              <code
                className="yaml-tokens font-mono text-xs leading-5 [tab-size:2]"
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
            className="relative z-10 min-h-55 w-full resize-y overflow-auto bg-transparent p-3 font-mono text-xs leading-5 break-all whitespace-pre-wrap [tab-size:2] text-transparent caret-foreground selection:bg-primary/20 selection:text-transparent focus:outline-none"
            aria-label={ariaLabel}
          />
        </div>
      </div>

      {/* Inline Validation Warnings */}
      {validationErrors && validationErrors.length > 0 && (
        <div className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <div className="flex items-center gap-1.5 font-medium">
            <WarningIcon className="size-4 shrink-0" />
            <span>YAML formatting issues detected:</span>
          </div>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-2xs">
            {validationErrors.map((err, i) => (
              <li key={i}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      <style jsx global>{`
        .yaml-tokens .token.key,
        .yaml-tokens .token.attr-name {
          color: #0284c7;
          font-weight: 600;
        }
        :global(.dark) .yaml-tokens .token.key,
        :global(.dark) .yaml-tokens .token.attr-name {
          color: #38bdf8;
          font-weight: 600;
        }
        .yaml-tokens .token.string {
          color: #15803d;
        }
        :global(.dark) .yaml-tokens .token.string {
          color: #4ade80;
        }
        .yaml-tokens .token.boolean {
          color: #7c3aed;
        }
        :global(.dark) .yaml-tokens .token.boolean {
          color: #c084fc;
        }
        .yaml-tokens .token.number {
          color: #b45309;
        }
        :global(.dark) .yaml-tokens .token.number {
          color: #fbbf24;
        }
        .yaml-tokens .token.comment {
          color: #71717a;
          font-style: italic;
        }
        :global(.dark) .yaml-tokens .token.comment {
          color: #71717a;
          font-style: italic;
        }
        .yaml-tokens .token.punctuation {
          color: #71717a;
        }
        :global(.dark) .yaml-tokens .token.punctuation {
          color: #a1a1aa;
        }
      `}</style>
    </div>
  )
}
