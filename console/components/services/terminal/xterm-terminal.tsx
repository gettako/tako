'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { Terminal as XtermType } from '@xterm/xterm';
import type { FitAddon as FitAddonType } from '@xterm/addon-fit';
import { useTheme } from 'next-themes';
import { Service } from '@/lib/types';
import { execServiceCommand } from '@/lib/api/services';

export interface XtermTerminalRef {
  clear: () => void;
  fit: () => void;
  write: (data: string) => void;
  writeln: (data: string) => void;
  focus: () => void;
}

export interface XtermTerminalProps {
  service: Service;
  containerName: string;
  className?: string;
}

const TERMINAL_THEMES = {
  dark: {
    background: '#0B0C14',
    foreground: '#F8FAFC',
    cursor: '#5B63D3',
    cursorAccent: '#0B0C14',
    selectionBackground: 'rgba(91, 99, 211, 0.35)',
    black: '#1E293B',
    red: '#FF5A6A',
    green: '#10B981',
    yellow: '#F59E0B',
    blue: '#5B63D3',
    magenta: '#98A4F7',
    cyan: '#38BDF8',
    white: '#F8FAFC',
    brightBlack: '#64748B',
    brightRed: '#F87171',
    brightGreen: '#34D399',
    brightYellow: '#FBBF24',
    brightBlue: '#818CF8',
    brightMagenta: '#C084FC',
    brightCyan: '#67E8F9',
    brightWhite: '#FFFFFF',
  },
  light: {
    background: '#FFFFFF',
    foreground: '#0F172A',
    cursor: '#432DD7',
    cursorAccent: '#FFFFFF',
    selectionBackground: 'rgba(67, 45, 215, 0.20)',
    black: '#0F172A',
    red: '#DC2626',
    green: '#059669',
    yellow: '#D97706',
    blue: '#432DD7',
    magenta: '#7C3AED',
    cyan: '#0891B2',
    white: '#F1F5F9',
    brightBlack: '#475569',
    brightRed: '#EF4444',
    brightGreen: '#10B981',
    brightYellow: '#F59E0B',
    brightBlue: '#6366F1',
    brightMagenta: '#8B5CF6',
    brightCyan: '#06B6D4',
    brightWhite: '#0F172A',
  },
};

export const XtermTerminal = forwardRef<XtermTerminalRef, XtermTerminalProps>(
  function XtermTerminal({ service, containerName, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XtermType | null>(null);
    const fitAddonRef = useRef<FitAddonType | null>(null);
    const { resolvedTheme } = useTheme();

    // Persistent interactive state
    const inputBufferRef = useRef<string>('');
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef<number>(-1);
    const isProcessingRef = useRef<boolean>(false);

    // Standard root container shell prompt
    const getPrompt = () => {
      return '# ';
    };

    // Forward ref methods
    useImperativeHandle(ref, () => ({
      clear: () => {
        if (termRef.current) {
          termRef.current.clear();
          termRef.current.write(getPrompt());
          inputBufferRef.current = '';
        }
      },
      fit: () => {
        try {
          fitAddonRef.current?.fit();
        } catch {
          // ignore if unattached
        }
      },
      write: (data: string) => {
        termRef.current?.write(data);
      },
      writeln: (data: string) => {
        termRef.current?.writeln(data);
      },
      focus: () => {
        termRef.current?.focus();
      },
    }));

    // Update terminal theme dynamically when light/dark mode changes
    useEffect(() => {
      if (!termRef.current) return;
      const themeConfig = resolvedTheme === 'light' ? TERMINAL_THEMES.light : TERMINAL_THEMES.dark;
      termRef.current.options.theme = themeConfig;
    }, [resolvedTheme]);

    // Handle container changes without breaking session
    const prevContainerRef = useRef<string>(containerName);
    useEffect(() => {
      if (prevContainerRef.current !== containerName && termRef.current) {
        prevContainerRef.current = containerName;
        termRef.current.writeln(
          `\r\n\x1b[32mConnected to container ${containerName}\x1b[0m\r\n`
        );
        termRef.current.write(getPrompt());
        inputBufferRef.current = '';
      }
    }, [containerName]);

    // Initialize xterm.js once
    useEffect(() => {
      let isMounted = true;
      let resizeObserver: ResizeObserver | null = null;

      async function initXterm() {
        if (!containerRef.current || termRef.current) return;

        const { Terminal } = await import('@xterm/xterm');
        const { FitAddon } = await import('@xterm/addon-fit');

        if (!isMounted || !containerRef.current) return;

        const themeConfig =
          resolvedTheme === 'light' ? TERMINAL_THEMES.light : TERMINAL_THEMES.dark;

        const term = new Terminal({
          cursorBlink: true,
          cursorStyle: 'block',
          fontSize: 13,
          lineHeight: 1.4,
          fontFamily: 'Iosevka, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          theme: themeConfig,
          convertEol: true,
          scrollback: 5000,
          allowTransparency: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(containerRef.current);
        termRef.current = term;
        fitAddonRef.current = fitAddon;

        // Auto-fit immediately
        setTimeout(() => {
          if (isMounted) {
            try {
              fitAddon.fit();
            } catch {
              // ignore
            }
          }
        }, 30);

        // Auto-fit after webfonts are fully ready
        if (typeof document !== 'undefined' && 'fonts' in document) {
          document.fonts.ready.then(() => {
            if (isMounted) {
              try {
                fitAddon.fit();
              } catch {
                // ignore
              }
            }
          });
        }

        // ResizeObserver to automatically refit when card/dialog resizes
        resizeObserver = new ResizeObserver(() => {
          try {
            fitAddon.fit();
          } catch {
            // ignore
          }
        });
        resizeObserver.observe(containerRef.current);

        // Clean initial connection message without fake/meaningless text
        term.writeln(`\x1b[32mConnected to container ${containerName}\x1b[0m\r\n`);
        term.write(getPrompt());

        // Command Execution Engine
        const executeCommand = async (cmdStr: string) => {
          const trimmed = cmdStr.trim();
          if (!trimmed) {
            term.write(getPrompt());
            return;
          }

          // Add to history
          historyRef.current.push(trimmed);
          historyIndexRef.current = -1;

          if (trimmed.toLowerCase() === 'clear') {
            term.clear();
            term.write(getPrompt());
            return;
          }

          if (trimmed.toLowerCase() === 'exit') {
            term.writeln('\x1b[33mContainer session is persistent. To close, use the Minimize or Fullscreen controls.\x1b[0m');
            term.write(getPrompt());
            return;
          }

          isProcessingRef.current = true;
          try {
            const res = await execServiceCommand(service.id, trimmed, containerName);
            const out = (res.output || '').trimEnd();
            if (out) {
              const formatted = out.replace(/\r?\n/g, '\r\n');
              term.writeln(formatted);
            } else if (res.exitCode !== 0) {
              term.writeln(`\x1b[31mProcess exited with code ${res.exitCode}\x1b[0m`);
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Execution failed';
            term.writeln(`\x1b[31m[error] ${message}\x1b[0m`);
          } finally {
            isProcessingRef.current = false;
            term.write(getPrompt());
          }
        };

        // Handle raw keyboard events in terminal
        term.onData(async (data) => {
          if (isProcessingRef.current) return;

          // Enter key
          if (data === '\r') {
            term.write('\r\n');
            const cmd = inputBufferRef.current;
            inputBufferRef.current = '';
            await executeCommand(cmd);
          }
          // Backspace
          else if (data === '\x7f' || data === '\b') {
            if (inputBufferRef.current.length > 0) {
              inputBufferRef.current = inputBufferRef.current.slice(0, -1);
              term.write('\b \b');
            }
          }
          // Ctrl+C
          else if (data === '\x03') {
            inputBufferRef.current = '';
            term.write('^C\r\n');
            term.write(getPrompt());
          }
          // Ctrl+L (Clear screen)
          else if (data === '\x0c') {
            term.clear();
            term.write(getPrompt() + inputBufferRef.current);
          }
          // Arrow Up (History back)
          else if (data === '\x1b[A') {
            const hist = historyRef.current;
            if (hist.length > 0) {
              const nextIndex =
                historyIndexRef.current === -1
                  ? hist.length - 1
                  : Math.max(0, historyIndexRef.current - 1);
              historyIndexRef.current = nextIndex;
              const target = hist[nextIndex];

              // Erase current line
              while (inputBufferRef.current.length > 0) {
                term.write('\b \b');
                inputBufferRef.current = inputBufferRef.current.slice(0, -1);
              }
              inputBufferRef.current = target;
              term.write(target);
            }
          }
          // Arrow Down (History forward)
          else if (data === '\x1b[B') {
            const hist = historyRef.current;
            if (historyIndexRef.current !== -1) {
              const nextIndex = historyIndexRef.current + 1;
              while (inputBufferRef.current.length > 0) {
                term.write('\b \b');
                inputBufferRef.current = inputBufferRef.current.slice(0, -1);
              }

              if (nextIndex >= hist.length) {
                historyIndexRef.current = -1;
                inputBufferRef.current = '';
              } else {
                historyIndexRef.current = nextIndex;
                const target = hist[nextIndex];
                inputBufferRef.current = target;
                term.write(target);
              }
            }
          }
          // Tab (Autocomplete)
          else if (data === '\t') {
            const commands = [
              'ls',
              'ps',
              'env',
              'whoami',
              'pwd',
              'uname',
              'uptime',
              'cat',
              'ping',
              'top',
              'date',
              'clear',
            ];
            const current = inputBufferRef.current.trim();
            if (current) {
              const match = commands.find((c) => c.startsWith(current));
              if (match && match !== current) {
                const diff = match.slice(current.length);
                inputBufferRef.current += diff;
                term.write(diff);
              }
            }
          }
          // Printable characters
          else if (data >= ' ') {
            inputBufferRef.current += data;
            term.write(data);
          }
        });
      }

      initXterm();

      return () => {
        isMounted = false;
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (termRef.current) {
          termRef.current.dispose();
          termRef.current = null;
        }
      };
    }, []);

    return (
      <div
        className={`w-full h-full min-h-[360px] p-3 font-mono text-xs select-text focus:outline-none ${className || ''}`}
        onClick={() => termRef.current?.focus()}
      >
        <div ref={containerRef} className="w-full h-full" />
      </div>
    );
  }
);
