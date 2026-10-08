'use client';

import React, { useMemo, useState, useRef } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import { 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  ArrowDownAZ, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Configure DotEnv grammar on Prism for in-editor live syntax highlighting
if (typeof Prism !== 'undefined' && !Prism.languages.dotenv) {
  Prism.languages.dotenv = {
    comment: {
      pattern: /(^#|\s+#).*/m,
      greedy: true,
    },
    variable: {
      pattern: /^\s*[A-Za-z_][A-Za-z0-9_]*(?=\s*=)/m,
      alias: 'property',
    },
    operator: /=/,
    string: {
      pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
      greedy: true,
    },
    number: /\b\d+(?:\.\d+)?\b/,
    boolean: /\b(?:true|false)\b/i,
    interpolation: {
      pattern: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/,
      alias: 'variable',
    },
    punctuation: /[{}[\];(),.:]/,
  };
}

const PLACEHOLDER_ENV = `# Takō Environment Configuration
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://user:pass@host:5432/db
API_KEY=sk_live_abcdef123456`;

export interface EnvRawViewProps {
  rawContent: string;
  onChange: (val: string) => void;
}

export function EnvRawView({ rawContent, onChange }: EnvRawViewProps) {
  const [copied, setCopied] = useState(false);
  const [maskSecrets, setMaskSecrets] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => {
    return rawContent.split('\n');
  }, [rawContent]);

  const lineCount = lines.length;
  const isContentEmpty = !rawContent.trim();
  const placeholderLinesCount = useMemo(() => PLACEHOLDER_ENV.split('\n').length, []);
  const gutterLinesCount = isContentEmpty ? placeholderLinesCount : Math.max(lineCount, 1);

  // Real-time analysis of the env configuration
  const stats = useMemo(() => {
    let variableCount = 0;
    let commentCount = 0;
    let invalidCount = 0;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (trimmed.startsWith('#')) {
        commentCount++;
      } else if (trimmed.includes('=')) {
        variableCount++;
      } else {
        invalidCount++;
      }
    });

    return { variableCount, commentCount, invalidCount };
  }, [lines]);

  // Mask sensitive values if toggle is enabled
  const displayContent = useMemo(() => {
    if (!maskSecrets) return rawContent;

    return lines
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return line;

        const key = line.slice(0, eqIdx);
        const val = line.slice(eqIdx + 1);
        const isSecret = /secret|key|token|password|auth|pass|cred|private/i.test(key);

        if (isSecret && val.trim().length > 0) {
          return `${key}=••••••••••••`;
        }
        return line;
      })
      .join('\n');
  }, [rawContent, maskSecrets, lines]);

  // Synchronous, zero-latency Prism highlighting function
  const highlightCode = (code: string) => {
    try {
      if (Prism.languages.dotenv) {
        return Prism.highlight(code, Prism.languages.dotenv, 'dotenv');
      }
    } catch {
      // Fallback
    }
    return code;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleSortAlphabetical = () => {
    const validPairs: { key: string; full: string }[] = [];
    const nonVars: string[] = [];

    lines.forEach((l) => {
      const trimmed = l.trim();
      if (trimmed && !trimmed.startsWith('#') && l.includes('=')) {
        const key = l.split('=')[0].trim();
        validPairs.push({ key, full: l });
      } else if (trimmed) {
        nonVars.push(l);
      }
    });

    validPairs.sort((a, b) => a.key.localeCompare(b.key));
    const sortedResult = [
      ...nonVars,
      ...(nonVars.length > 0 && validPairs.length > 0 ? [''] : []),
      ...validPairs.map((p) => p.full),
    ].join('\n');

    onChange(sortedResult);
  };

  const handleFormatClean = () => {
    const cleaned = lines
      .map((l) => l.trimEnd())
      .filter((l, idx, arr) => !(l === '' && arr[idx - 1] === ''))
      .join('\n');
    onChange(cleaned);
  };

  return (
    <Card className="p-0 overflow-hidden border border-border bg-background">
      {/* Editor Header & Utilities */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-foreground">.env</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">— Interactive DotEnv Editor</span>
          </div>

          {/* Validation & Stats Badge */}
          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground border-l border-border pl-3">
            <span className="flex items-center gap-1">
              {stats.invalidCount === 0 ? (
                <CheckCircle2 className="size-3 text-status-success" />
              ) : (
                <AlertCircle className="size-3 text-amber-500" />
              )}
              {stats.variableCount} vars
            </span>
            <span>•</span>
            <span>{isContentEmpty ? 0 : lineCount} lines</span>
          </div>
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMaskSecrets(!maskSecrets)}
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground px-2"
            title={maskSecrets ? 'Reveal secret values' : 'Mask secret values'}
          >
            {maskSecrets ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            <span className="hidden md:inline">{maskSecrets ? 'Masked' : 'Reveal'}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSortAlphabetical}
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground px-2"
            title="Sort variables alphabetically (A-Z)"
          >
            <ArrowDownAZ className="size-3.5" />
            <span className="hidden md:inline">Sort A-Z</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleFormatClean}
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground px-2"
            title="Clean trailing whitespace and blank lines"
          >
            <Sparkles className="size-3.5" />
            <span className="hidden md:inline">Clean</span>
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-7 text-xs gap-1.5 border-border bg-background hover:bg-muted"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-status-success" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Unified Live Syntax-Highlighted Editor */}
      <div 
        ref={containerRef}
        className="flex min-h-[380px] max-h-[580px] overflow-auto bg-background"
      >
        {/* Line Numbers Gutter (Sticky left, perfectly aligned line heights) */}
        <div
          aria-hidden="true"
          className="select-none sticky left-0 z-10 w-12 border-r border-border bg-background py-3 pr-3 text-right font-mono text-xs shrink-0 leading-[21px]"
        >
          {Array.from({ length: gutterLinesCount }).map((_, idx) => (
            <div
              key={idx}
              className={`h-[21px] ${
                isContentEmpty ? 'text-muted-foreground/30' : 'text-muted-foreground/50'
              }`}
            >
              {idx + 1}
            </div>
          ))}
        </div>

        {/* Live Code Editor with Prism Highlighting */}
        <div className="flex-1 min-w-0 bg-background flex flex-col">
          <Editor
            value={displayContent}
            onValueChange={(newVal) => {
              if (maskSecrets) {
                setMaskSecrets(false);
              }
              onChange(newVal);
            }}
            highlight={highlightCode}
            padding={12}
            className="flex-1 font-mono text-xs leading-[21px] text-foreground"
            textareaClassName="focus:outline-none bg-transparent caret-primary text-foreground placeholder:text-muted-foreground/40 placeholder:font-mono"
            preClassName="prism-code"
            placeholder={PLACEHOLDER_ENV}
            style={{
              fontFamily: 'Iosevka, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '12px',
              lineHeight: '21px',
              minHeight: '380px',
              width: '100%',
              whiteSpace: 'pre',
            }}
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-border bg-muted/10 px-4 py-2 text-[11px] text-muted-foreground">
        <span>Type or paste directly — syntax is highlighted live</span>
        <span className="font-mono">Prism.js Realtime Highlighter</span>
      </div>
    </Card>
  );
}
