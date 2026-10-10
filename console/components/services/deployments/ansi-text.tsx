'use client';

import React, { useMemo } from 'react';

interface AnsiSegment {
  text: string;
  className: string;
}

const COLOR_MAP: Record<number, string> = {
  30: 'text-zinc-500 dark:text-zinc-400',
  31: 'text-rose-500 dark:text-rose-400 font-medium',
  32: 'text-emerald-600 dark:text-emerald-400 font-medium',
  33: 'text-amber-600 dark:text-amber-300 font-medium',
  34: 'text-blue-600 dark:text-blue-400',
  35: 'text-purple-600 dark:text-purple-400',
  36: 'text-cyan-600 dark:text-cyan-400',
  37: 'text-zinc-700 dark:text-zinc-300',
  90: 'text-zinc-400 dark:text-zinc-500',
  91: 'text-rose-400',
  92: 'text-emerald-400',
  93: 'text-yellow-400',
  94: 'text-blue-400',
  95: 'text-purple-400',
  96: 'text-cyan-400',
  97: 'text-zinc-100 font-medium',
};

export function parseAnsiString(raw: string): AnsiSegment[] {
  if (!raw) return [];
  // Quick return if string has no escape sequence
  if (!raw.includes('\u001b') && !raw.includes('\x1b')) {
    return [{ text: raw, className: '' }];
  }

  // Regex matching ANSI escape sequences: \x1b[ ... m or \u001b[ ... m
  const regex = /(?:\u001b|\x1b)\[([0-9;]*)m/g;
  const segments: AnsiSegment[] = [];

  let lastIndex = 0;
  let currentColorClass = '';
  let isBold = false;
  let isUnderline = false;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const textChunk = raw.slice(lastIndex, match.index);
    if (textChunk) {
      const classes = [currentColorClass, isBold ? 'font-bold' : '', isUnderline ? 'underline' : '']
        .filter(Boolean)
        .join(' ');
      segments.push({ text: textChunk, className: classes });
    }

    const codeStr = match[1] || '0';
    const codes = codeStr.split(';').map((c) => parseInt(c, 10) || 0);

    for (const code of codes) {
      if (code === 0) {
        currentColorClass = '';
        isBold = false;
        isUnderline = false;
      } else if (code === 1) {
        isBold = true;
      } else if (code === 4) {
        isUnderline = true;
      } else if (COLOR_MAP[code]) {
        currentColorClass = COLOR_MAP[code];
      }
    }

    lastIndex = regex.lastIndex;
  }

  const remaining = raw.slice(lastIndex);
  if (remaining) {
    // Strip any other non-color ANSI codes (like cursor moves \x1b[2K)
    const cleaned = remaining.replace(/(?:\u001b|\x1b)\[[0-9;]*[a-zA-Z]/g, '');
    if (cleaned) {
      const classes = [currentColorClass, isBold ? 'font-bold' : '', isUnderline ? 'underline' : '']
        .filter(Boolean)
        .join(' ');
      segments.push({ text: cleaned, className: classes });
    }
  }

  return segments;
}

export function AnsiText({ text }: { text: string }) {
  const segments = useMemo(() => parseAnsiString(text), [text]);

  if (segments.length === 1 && !segments[0].className) {
    return <span>{segments[0].text}</span>;
  }

  return (
    <span>
      {segments.map((seg, i) =>
        seg.className ? (
          <span key={i} className={seg.className}>
            {seg.text}
          </span>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        )
      )}
    </span>
  );
}
