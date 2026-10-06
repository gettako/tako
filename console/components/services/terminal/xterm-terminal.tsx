'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { Terminal as XtermType } from '@xterm/xterm';
import type { FitAddon as FitAddonType } from '@xterm/addon-fit';
import { useTheme } from 'next-themes';
import { Service } from '@/lib/types';

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

    // Prompt generator
    const getPrompt = () => {
      const isDark = resolvedTheme !== 'light';
      const userHost = isDark
        ? '\x1b[1;38;2;91;99;211mroot@tako\x1b[0m'
        : '\x1b[1;38;2;67;45;215mroot@tako\x1b[0m';
      const path = isDark ? '\x1b[1;36m/app\x1b[0m' : '\x1b[1;34m/app\x1b[0m';
      return `${userHost}:${path}# `;
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
          `\r\n\x1b[36m[*] Switched target container to: ${containerName}\x1b[0m`
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
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
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

        // ResizeObserver to automatically refit when card/dialog resizes
        resizeObserver = new ResizeObserver(() => {
          try {
            fitAddon.fit();
          } catch {
            // ignore
          }
        });
        resizeObserver.observe(containerRef.current);

        // Initial welcome message
        term.writeln(`\x1b[1;32mConnected to container ${containerName} (Alpine Linux 3.20.3)\x1b[0m`);
        term.writeln(`\x1b[90mLinux 6.6.32-linuxkit #1 SMP aarch64 • Takō Container Namespace\x1b[0m`);
        term.writeln(`Type \x1b[1mhelp\x1b[0m to inspect available commands.\r\n`);
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

          const [command, ...args] = trimmed.split(/\s+/);
          const lowerCmd = command.toLowerCase();

          switch (lowerCmd) {
            case 'help':
              term.writeln('\x1b[1mAvailable diagnostic commands:\x1b[0m');
              term.writeln('  \x1b[36mhelp\x1b[0m                  Show this help reference');
              term.writeln('  \x1b[36mls [-la]\x1b[0m              List directory contents');
              term.writeln('  \x1b[36mps [aux]\x1b[0m              List active container processes');
              term.writeln('  \x1b[36menv\x1b[0m                   Print container environment variables');
              term.writeln('  \x1b[36mwhoami\x1b[0m                Print effective user id');
              term.writeln('  \x1b[36mpwd\x1b[0m                   Print working directory name');
              term.writeln('  \x1b[36muname -a\x1b[0m              Print kernel and operating system info');
              term.writeln('  \x1b[36muptime\x1b[0m                Show container uptime and system load');
              term.writeln('  \x1b[36mcat <file>\x1b[0m            Print file contents (e.g. package.json)');
              term.writeln('  \x1b[36mping <host>\x1b[0m           Send ICMP packets to test connectivity');
              term.writeln('  \x1b[36mtop\x1b[0m                   Display live container CPU & memory');
              term.writeln('  \x1b[36mdate\x1b[0m                  Display current UTC time');
              term.writeln('  \x1b[36mclear\x1b[0m                 Clear terminal screen');
              break;

            case 'clear':
              term.clear();
              break;

            case 'whoami':
              term.writeln('root');
              break;

            case 'pwd':
              term.writeln('/app');
              break;

            case 'date':
              term.writeln(new Date().toUTCString());
              break;

            case 'uname':
              term.writeln('Linux tako-host 6.6.32-linuxkit #1 SMP aarch64 Linux');
              break;

            case 'uptime':
              term.writeln(
                '14:26:08 up 14 days,  4:32,  1 user,  load average: 0.12, 0.18, 0.14'
              );
              break;

            case 'ls':
              if (args.includes('-la') || args.includes('-l') || args.includes('-a')) {
                term.writeln('total 48');
                term.writeln('drwxr-xr-x   14 root     root          4096 Oct  6 04:12 \x1b[1;34m.\x1b[0m');
                term.writeln('drwxr-xr-x    3 root     root          4096 Oct  6 04:00 \x1b[1;34m..\x1b[0m');
                term.writeln('-rw-r--r--    1 root     root           340 Oct  6 04:10 Dockerfile');
                term.writeln('-rw-r--r--    1 root     root          1240 Oct  6 04:10 README.md');
                term.writeln('drwxr-xr-x    8 root     root          4096 Oct  6 04:12 \x1b[1;34mapp\x1b[0m');
                term.writeln('drwxr-xr-x  820 root     root          4096 Oct  6 04:11 \x1b[1;34mnode_modules\x1b[0m');
                term.writeln('-rw-r--r--    1 root     root          1101 Oct  6 04:10 package.json');
                term.writeln('drwxr-xr-x    2 root     root          4096 Oct  6 04:10 \x1b[1;34mpublic\x1b[0m');
                term.writeln('-rw-r--r--    1 root     root           538 Oct  6 04:10 tsconfig.json');
              } else {
                term.writeln(
                  'Dockerfile  README.md  \x1b[1;34mapp\x1b[0m  \x1b[1;34mnode_modules\x1b[0m  package.json  \x1b[1;34mpublic\x1b[0m  tsconfig.json'
                );
              }
              break;

            case 'ps':
              term.writeln('PID   USER     TIME  COMMAND');
              term.writeln('  1   root     4:12  node server.js');
              term.writeln(' 18   root     0:01  takod --worker-runtime');
              term.writeln(' 24   root     0:00  /bin/sh');
              term.writeln(' 48   root     0:00  ps ' + args.join(' '));
              break;

            case 'env':
              const envList = service.envVars || [];
              if (envList.length > 0) {
                envList.forEach((ev) => {
                  const val = ev.isSecret ? '••••••••••••' : ev.value;
                  term.writeln(`\x1b[36m${ev.key}\x1b[0m=${val}`);
                });
              } else {
                term.writeln('\x1b[36mNODE_ENV\x1b[0m=production');
                term.writeln('\x1b[36mPORT\x1b[0m=3000');
                term.writeln(`\x1b[36mHOSTNAME\x1b[0m=${containerName}`);
              }
              break;

            case 'cat':
              const filename = args[0];
              if (!filename) {
                term.writeln('\x1b[31mcat: missing file operand\x1b[0m');
              } else if (filename === 'package.json') {
                term.writeln('{\n  "name": "' + service.slug + '",\n  "version": "1.0.0",\n  "scripts": {\n    "start": "node server.js"\n  }\n}');
              } else if (filename === 'Dockerfile') {
                term.writeln('FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install --production\nCOPY . .\nEXPOSE 3000\nCMD ["node", "server.js"]');
              } else if (filename === 'README.md') {
                term.writeln('# ' + service.name + '\nManaged container service deployed on Takō Cloud.');
              } else {
                term.writeln(`\x1b[31mcat: ${filename}: No such file or directory\x1b[0m`);
              }
              break;

            case 'ping':
              const host = args[0] || '1.1.1.1';
              term.writeln(`PING ${host} (${host}): 56 data bytes`);
              isProcessingRef.current = true;
              for (let i = 0; i < 3; i++) {
                await new Promise((r) => setTimeout(r, 400));
                term.writeln(`64 bytes from ${host}: seq=${i} ttl=58 time=${(12.4 + i * 1.8).toFixed(2)} ms`);
              }
              term.writeln(`--- ${host} ping statistics ---`);
              term.writeln('3 packets transmitted, 3 packets received, 0% packet loss');
              isProcessingRef.current = false;
              break;

            case 'top':
              term.writeln('Mem: 142MB used, 370MB free, 8MB buff, 52MB cached');
              term.writeln('CPU:  2.4% usr  1.2% sys  0.0% nic 96.4% idle  0.0% io');
              term.writeln('Load average: 0.12 0.18 0.14 2/84 52');
              term.writeln('  PID  PPID USER     STAT   VSZ %VSZ CPU %CPU COMMAND');
              term.writeln('    1     0 root     S     320m  6.2   0  2.1 node server.js');
              term.writeln('   18     1 root     S      45m  0.9   1  0.2 takod');
              break;

            case 'exit':
              term.writeln('\x1b[33mContainer session is persistent. To close, use the Minimize or Fullscreen controls.\x1b[0m');
              break;

            default:
              term.writeln(`\x1b[31msh: ${command}: command not found. Type "help" for a list.\x1b[0m`);
          }

          term.write(getPrompt());
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
              'help',
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
        ref={containerRef}
        className={`w-full h-full min-h-[360px] p-3 font-mono text-xs select-text focus:outline-none ${className || ''}`}
        onClick={() => termRef.current?.focus()}
      />
    );
  }
);
