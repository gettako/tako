"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { copyToClipboard } from "@/lib/clipboard"
import { Prism } from "@/lib/prism"
import { cn } from "@/lib/utils"

interface CodeHighlighterProps {
  code: string
  language: "json" | "dotenv" | "bash" | "yaml" | "docker" | "log" | string
  className?: string
  showCopy?: boolean
  maxHeight?: string
  showLineNumbers?: boolean
}

export function CodeHighlighter({
  code,
  language,
  className,
  showCopy = true,
  maxHeight = "max-h-72",
  showLineNumbers = false,
}: CodeHighlighterProps) {
  const [copied, setCopied] = React.useState(false)

  const highlightedHtml = React.useMemo(() => {
    try {
      const langKey =
        language === "yml"
          ? "yaml"
          : language === "dockerfile"
            ? "docker"
            : language
      const grammar = Prism.languages[langKey] || Prism.languages.json
      return Prism.highlight(code || "", grammar, langKey)
    } catch {
      return code || ""
    }
  }, [code, language])

  const handleCopy = async () => {
    if (await copyToClipboard(code)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const lines = React.useMemo(() => (code || "").split("\n"), [code])

  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-muted/30 text-xs text-foreground dark:bg-muted/15",
        className
      )}
    >
      {showCopy && (
        <div className="absolute top-2.5 right-2.5 z-10">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={handleCopy}
            className="h-7 gap-1.5 border-border/80 bg-background/80 px-2.5 text-[11px] font-medium shadow-xs backdrop-blur-sm hover:bg-background"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3 text-muted-foreground" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      )}

      <div
        className={cn(
          "[scrollbar-gutter:stable] overflow-auto p-3.5 font-mono text-[11.5px] leading-relaxed",
          maxHeight
        )}
      >
        {showLineNumbers ? (
          <div className="flex font-mono">
            <div className="mr-3 text-right font-mono text-muted-foreground/40 select-none">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <pre
              className="syntax-highlighter flex-1 overflow-x-auto text-foreground"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </div>
        ) : (
          <pre
            className="syntax-highlighter overflow-x-auto text-foreground"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        )}
      </div>
    </div>
  )
}
