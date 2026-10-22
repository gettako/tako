"use client"

import * as React from "react"
import { Check, Copy, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { copyToClipboard } from "@/lib/clipboard"
import { Prism } from "@/lib/prism"
import { cn } from "@/lib/utils"

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: "dotenv" | "docker" | "yaml" | "json" | "bash" | "log" | string
  className?: string
  minHeight?: string
  maxHeight?: string
  placeholder?: string
  readOnly?: boolean
  showLineNumbers?: boolean
  showCopy?: boolean
  showSave?: boolean
  onSave?: () => void
  isSaved?: boolean
  title?: string
  statusInfo?: string
}

export function CodeEditor({
  value,
  onChange,
  language,
  className,
  minHeight = "min-h-[320px]",
  maxHeight = "max-h-[550px]",
  placeholder,
  readOnly = false,
  showLineNumbers = true,
  showCopy = true,
  showSave = false,
  onSave,
  isSaved = false,
  title,
  statusInfo,
}: CodeEditorProps) {
  const [copied, setCopied] = React.useState(false)

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const preRef = React.useRef<HTMLPreElement>(null)
  const lineNumbersRef = React.useRef<HTMLDivElement>(null)

  const highlightedHtml = React.useMemo(() => {
    try {
      const langKey =
        language === "yml"
          ? "yaml"
          : language === "dockerfile"
            ? "docker"
            : language
      const grammar =
        Prism.languages[langKey] ||
        Prism.languages.dotenv ||
        Prism.languages.json
      return Prism.highlight(value || "", grammar, langKey)
    } catch {
      return value || ""
    }
  }, [value, language])

  const lines = React.useMemo(() => {
    const split = (value || "").split("\n")
    return split.length === 0 ? [""] : split
  }, [value])

  const handleScroll = React.useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const { scrollTop, scrollLeft } = textarea

    if (preRef.current) {
      preRef.current.scrollTop = scrollTop
      preRef.current.scrollLeft = scrollLeft
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const updated = value.substring(0, start) + "  " + value.substring(end)
      onChange(updated)
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      })
    }

    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault()
      onSave?.()
    }
  }

  const handleCopy = async () => {
    if (await copyToClipboard(value)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-lg border border-border bg-card shadow-xs",
        className
      )}
    >
      {/* Editor Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3.5 py-2">
        <div className="flex items-center gap-2">
          {title && (
            <span className="font-mono text-xs font-semibold text-foreground">
              {title}
            </span>
          )}
          <span className="rounded border border-border/80 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
            {language}
          </span>
          {statusInfo && (
            <span className="text-xs text-muted-foreground">{statusInfo}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showCopy && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={handleCopy}
              className="h-7 gap-1.5 px-2.5 text-[11px]"
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
          )}

          {showSave && onSave && (
            <Button
              type="button"
              size="xs"
              onClick={onSave}
              className="h-7 gap-1.5 px-2.5 text-[11px]"
            >
              {isSaved ? (
                <>
                  <Check className="size-3 text-emerald-500" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Save className="size-3" />
                  <span>Save</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Editor Body */}
      <div
        className={cn(
          "relative flex flex-1 overflow-hidden font-mono text-[11.5px] leading-relaxed",
          minHeight,
          maxHeight
        )}
      >
        {/* Line Numbers Gutter */}
        {showLineNumbers && (
          <div
            ref={lineNumbersRef}
            aria-hidden="true"
            className="w-10 shrink-0 overflow-hidden border-r border-border/60 bg-muted/20 py-3 pr-2.5 text-right font-mono text-[11px] leading-[20px] text-muted-foreground/45 select-none dark:bg-muted/10"
          >
            {lines.map((_, i) => (
              <div key={i} className="h-[20px]">
                {i + 1}
              </div>
            ))}
          </div>
        )}

        {/* Code Viewport with Syntax-Highlighted Pre & Interactive Textarea */}
        <div className="relative flex-1 overflow-hidden">
          {/* Highlighted text layer underneath */}
          <pre
            ref={preRef}
            aria-hidden="true"
            className="syntax-highlighter pointer-events-none absolute inset-0 m-0 overflow-hidden px-3.5 py-3 font-mono text-[11.5px] leading-[20px] text-foreground select-none"
            style={{
              tabSize: 2,
              whiteSpace: "pre",
              fontVariantLigatures: "none",
            }}
            dangerouslySetInnerHTML={{
              __html: highlightedHtml + (value.endsWith("\n") ? "\n " : ""),
            }}
          />

          {/* Interactive textarea layer on top */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            readOnly={readOnly}
            spellCheck={false}
            wrap="off"
            className="relative block h-full w-full resize-none border-0 bg-transparent px-3.5 py-3 font-mono text-[11.5px] leading-[20px] text-transparent caret-foreground selection:bg-primary/25 selection:text-foreground focus:outline-none"
            style={{
              tabSize: 2,
              whiteSpace: "pre",
              fontVariantLigatures: "none",
            }}
          />
        </div>
      </div>

      {/* Footer Hints */}
      <div className="flex items-center justify-between border-t border-border/60 bg-muted/15 px-3 py-1.5 font-mono text-[10.5px] text-muted-foreground">
        <span>
          {language === "dotenv"
            ? "KEY=VALUE format (supports # comments)"
            : `${language} syntax highlighted`}
        </span>
        <div className="flex items-center gap-3">
          <span>{lines.length} lines</span>
          <span>Tab to indent</span>
          {showSave && <span>Cmd/Ctrl+S to save</span>}
        </div>
      </div>
    </div>
  )
}
