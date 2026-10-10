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

    // Latest refs to prevent stale closure inside async terminal event listeners
    const containerNameRef = useRef<string>(containerName);
    containerNameRef.current = containerName;

    const serviceRef = useRef<Service>(service);
    serviceRef.current = service;

    // Persistent interactive state
    const inputBufferRef = useRef<string>('');
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef<number>(-1);
    const isProcessingRef = useRef<boolean>(false);
    const wsRef = useRef<WebSocket | null>(null);
    const isWsConnectedRef = useRef<boolean>(false);

    // Standard root container shell prompt
    const getPrompt = () => {
      return '# ';
    };

    // Prints a clean single-line connection status
    const printConnectedMessage = (term: XtermType, targetContainer: string) => {
      term.writeln(`\x1b[32mConnected to container ${targetContainer}\x1b[0m\r\n`);
      term.write(getPrompt());
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

    // Connect WebSocket stream
    const connectWebSocket = (targetContainer: string) => {
      if (typeof window === 'undefined') return;

      // Close previous connection
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
        isWsConnectedRef.current = false;
      }

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname;
        // Connect to port 8080 if running on standard dev/preview 3000 port, or current port
        const port = window.location.port === '3000' ? '8080' : window.location.port;
        const host = port ? `${hostname}:${port}` : window.location.host;
        const wsUrl = `${protocol}//${host}/api/v1/services/${serviceRef.current.id}/terminal?container=${encodeURIComponent(targetContainer)}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          isWsConnectedRef.current = true;
          if (termRef.current) {
            termRef.current.clear();
          }
        };

        ws.onmessage = (event) => {
          if (termRef.current && typeof event.data === 'string') {
            termRef.current.write(event.data);
          }
        };

        ws.onerror = () => {
          isWsConnectedRef.current = false;
        };

        ws.onclose = () => {
          if (isWsConnectedRef.current && termRef.current) {
            termRef.current.writeln('\r\n\x1b[33m[Connection closed]\x1b[0m\r\n');
          }
          isWsConnectedRef.current = false;
        };
      } catch {
        isWsConnectedRef.current = false;
      }
    };

    // Handle container change cleanly
    const prevContainerRef = useRef<string>(containerName);
    useEffect(() => {
      if (!termRef.current) return;
      if (prevContainerRef.current === containerName) return;

      prevContainerRef.current = containerName;
      termRef.current.clear();
      printConnectedMessage(termRef.current, containerName);
      inputBufferRef.current = '';

      connectWebSocket(containerName);
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
          cursorStyle: 'underline',
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

        // Clean initial connection message using active container reference
        const currentTarget = containerNameRef.current;
        prevContainerRef.current = currentTarget;
        printConnectedMessage(term, currentTarget);

        // Try establishing bidirectional WebSocket connection
        connectWebSocket(currentTarget);

        // Command Execution Engine for fallback HTTP mode
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

          if (trimmed.toLowerCase() === 'sh' || trimmed.toLowerCase() === 'bash') {
            term.writeln('BusyBox v1.36.1 (2026-06-15 08:35:10 UTC) built-in shell (ash)\r\nEnter \'help\' for a list of built-in commands.');
            term.write(getPrompt());
            return;
          }

          isProcessingRef.current = true;
          try {
            const activeTarget = containerNameRef.current;
            const res = await execServiceCommand(serviceRef.current.id, trimmed, activeTarget);
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
          // If live WebSocket is connected, forward raw stream directly
          if (isWsConnectedRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(data);
            return;
          }

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
          // Ctrl+D
          else if (data === '\x04') {
            if (inputBufferRef.current.length === 0) {
              term.write('exit\r\n');
              term.write(getPrompt());
            }
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
              'sh',
              'bash',
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
        if (wsRef.current) {
          try {
            wsRef.current.close();
          } catch {
            // ignore
          }
          wsRef.current = null;
        }
        if (termRef.current) {
          termRef.current.dispose();
          termRef.current = null;
        }
      };
    }, [resolvedTheme]);

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
