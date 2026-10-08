'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-json';
import {
  getNodeTraefikFiles,
  getNodeTraefikFileContent,
  saveNodeTraefikFile,
  deleteNodeTraefikFile,
  reloadNodeTraefik,
} from '@/lib/api/nodes';
import { Node, TraefikConfigFile } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FileCode2,
  FileJson,
  FileText,
  FolderTree,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Search,
  AlertCircle,
  CheckCircle2,
  FilePlus2,
  Sparkles,
  Loader2,
  Code2,
} from 'lucide-react';
import { toast } from 'sonner';

interface NodeTraefikFilesProps {
  node: Node;
}

const TEMPLATES: Record<string, { label: string; description: string; content: string }> = {
  router: {
    label: 'Custom Router & Service',
    description: 'Reverse proxy path/host route pointing to backend upstream',
    content: `# Dynamic reverse proxy configuration
http:
  routers:
    custom-router:
      rule: "Host(\`app.example.com\`)"
      service: custom-service
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
  services:
    custom-service:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:8080"
`,
  },
  ratelimit: {
    label: 'Rate Limiting Middleware',
    description: 'Prevent abuse by limiting requests per client IP',
    content: `# Rate limiting middleware
http:
  middlewares:
    api-ratelimit:
      rateLimit:
        average: 100
        burst: 50
        period: 1m
`,
  },
  basicauth: {
    label: 'Basic Authentication',
    description: 'Protect internal endpoints with username and password',
    content: `# HTTP Basic Authentication middleware
# Generate password hash with: htpasswd -nb username password
http:
  middlewares:
    admin-auth:
      basicAuth:
        users:
          - "admin:$$apr1$$H6usxDdf$$KdqsHG3tnmPqmUM5bUb+7."
`,
  },
  cors: {
    label: 'Security & CORS Headers',
    description: 'Enforce HSTS, frame options, and allowed HTTP methods',
    content: `# CORS and Security Headers
http:
  middlewares:
    cors-headers:
      headers:
        sslRedirect: true
        forceSTSHeader: true
        stsSeconds: 31536000
        accessControlAllowMethods:
          - "GET"
          - "POST"
          - "PUT"
          - "DELETE"
          - "OPTIONS"
        accessControlAllowOriginList:
          - "*"
`,
  },
  ipwhitelist: {
    label: 'IP Allowlist',
    description: 'Restrict access to trusted CIDR IP ranges only',
    content: `# IP Allowlist middleware
http:
  middlewares:
    internal-only:
      ipAllowList:
        sourceRange:
          - "127.0.0.1/32"
          - "192.168.1.0/24"
          - "10.0.0.0/8"
`,
  },
  blank: {
    label: 'Blank YAML File',
    description: 'Empty dynamic Traefik configuration file',
    content: `# Traefik dynamic configuration
http:
  routers: {}
  services: {}
  middlewares: {}
`,
  },
};

export function NodeTraefikFiles({ node }: NodeTraefikFilesProps) {
  const queryClient = useQueryClient();

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  // File content buffer & unsaved tracker
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [savedContents, setSavedContents] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Dialog state: Create new file
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('router');
  const [createError, setCreateError] = useState<string | null>(null);

  // Dialog state: Delete file confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Container ref
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Fetch files list
  const {
    data: files = [],
    isLoading: isFilesLoading,
    refetch: refetchFiles,
  } = useQuery({
    queryKey: ['node-traefik-files', node.id],
    queryFn: () => getNodeTraefikFiles(node.id),
  });

  // Select first file by default if none selected
  useEffect(() => {
    if (files.length > 0 && !selectedFileName) {
      setSelectedFileName(files[0].name);
    }
  }, [files, selectedFileName]);

  // Fetch content for selected file if not loaded
  const activeFile = useMemo(() => {
    return files.find((f) => f.name === selectedFileName) || null;
  }, [files, selectedFileName]);

  const { isLoading: isContentLoading } = useQuery({
    queryKey: ['node-traefik-file-content', node.id, selectedFileName],
    queryFn: async () => {
      if (!selectedFileName) return null;
      const data = await getNodeTraefikFileContent(node.id, selectedFileName);
      setFileContents((prev) => ({
        ...prev,
        [selectedFileName]: prev[selectedFileName] !== undefined ? prev[selectedFileName] : data.content,
      }));
      setSavedContents((prev) => ({
        ...prev,
        [selectedFileName]: data.content,
      }));
      return data;
    },
    enabled: !!selectedFileName,
  });

  // Current editor content
  const currentContent = useMemo(() => {
    if (!selectedFileName) return '';
    return fileContents[selectedFileName] ?? '';
  }, [fileContents, selectedFileName]);

  const isDirty = useMemo(() => {
    if (!selectedFileName) return false;
    const cur = fileContents[selectedFileName] ?? '';
    const saved = savedContents[selectedFileName] ?? '';
    return cur !== saved;
  }, [fileContents, savedContents, selectedFileName]);

  const lines = useMemo(() => currentContent.split('\n'), [currentContent]);
  const lineCount = lines.length;

  // Filtered files
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  // Syntax highlighting
  const highlightCode = useCallback(
    (code: string) => {
      try {
        const type = activeFile?.type || 'yaml';
        if (type === 'yaml' && Prism.languages.yaml) {
          return Prism.highlight(code, Prism.languages.yaml, 'yaml');
        }
        if (type === 'toml' && Prism.languages.toml) {
          return Prism.highlight(code, Prism.languages.toml, 'toml');
        }
        if (type === 'json' && Prism.languages.json) {
          return Prism.highlight(code, Prism.languages.json, 'json');
        }
      } catch {
        // Fallback
      }
      return code;
    },
    [activeFile]
  );

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFileName) return;
      return await saveNodeTraefikFile(node.id, selectedFileName, currentContent);
    },
    onSuccess: (data) => {
      if (selectedFileName && data) {
        setSavedContents((prev) => ({
          ...prev,
          [selectedFileName]: currentContent,
        }));
        queryClient.invalidateQueries({ queryKey: ['node-traefik-files', node.id] });
        toast.success(`File ${selectedFileName} saved successfully`);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save configuration file';
      toast.error(msg);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (filename: string) => {
      return await deleteNodeTraefikFile(node.id, filename);
    },
    onSuccess: (_, deletedName) => {
      toast.success(`File ${deletedName} deleted`);
      setDeleteTarget(null);
      setFileContents((prev) => {
        const copy = { ...prev };
        delete copy[deletedName];
        return copy;
      });
      setSavedContents((prev) => {
        const copy = { ...prev };
        delete copy[deletedName];
        return copy;
      });
      queryClient.invalidateQueries({ queryKey: ['node-traefik-files', node.id] });
      // Pick another file
      const remaining = files.filter((f) => f.name !== deletedName);
      if (remaining.length > 0) {
        setSelectedFileName(remaining[0].name);
      } else {
        setSelectedFileName(null);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete file';
      toast.error(msg);
    },
  });

  // Reload mutation
  const reloadMutation = useMutation({
    mutationFn: () => reloadNodeTraefik(node.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['node-traefik', node.id] });
      toast.success(data.message || 'Traefik dynamic rules reloaded on node');
    },
    onError: () => toast.error('Failed to reload Traefik configuration'),
  });

  // Keyboard shortcut for Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (selectedFileName && !saveMutation.isPending) {
          saveMutation.mutate();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFileName, currentContent, saveMutation]);

  // Copy code handler
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Clean trailing whitespace
  const handleFormatClean = () => {
    const cleaned = lines
      .map((l) => l.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
    if (selectedFileName) {
      setFileContents((prev) => ({
        ...prev,
        [selectedFileName]: cleaned,
      }));
      toast.success('Cleaned trailing whitespace');
    }
  };

  // Create new file submit
  const handleCreateFile = () => {
    setCreateError(null);
    let name = newFileName.trim();
    if (!name) {
      setCreateError('Filename cannot be empty');
      return;
    }

    // Auto-append .yml if no extension provided
    if (!name.includes('.')) {
      name += '.yml';
    }

    const lower = name.toLowerCase();
    if (!lower.endsWith('.yml') && !lower.endsWith('.yaml') && !lower.endsWith('.toml') && !lower.endsWith('.json')) {
      setCreateError('File must end with .yml, .yaml, .toml, or .json');
      return;
    }

    if (name.includes('/') || name.includes('\\') || name.includes('..')) {
      setCreateError('Invalid characters in filename');
      return;
    }

    // Check duplicate
    if (files.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      setCreateError(`A file named "${name}" already exists`);
      return;
    }

    const initialContent = TEMPLATES[selectedTemplateKey]?.content || TEMPLATES.blank.content;

    saveNodeTraefikFile(node.id, name, initialContent)
      .then((created) => {
        queryClient.invalidateQueries({ queryKey: ['node-traefik-files', node.id] });
        setSelectedFileName(created.name);
        setFileContents((prev) => ({ ...prev, [created.name]: initialContent }));
        setSavedContents((prev) => ({ ...prev, [created.name]: initialContent }));
        setCreateDialogOpen(false);
        setNewFileName('');
        toast.success(`Created file ${created.name}`);
      })
      .catch((err) => {
        setCreateError(err instanceof Error ? err.message : 'Failed to create file');
      });
  };

  const getFileIcon = (filename: string) => {
    if (filename.endsWith('.json')) return <FileJson className="size-4 text-amber-500" />;
    if (filename.endsWith('.toml')) return <FileText className="size-4 text-emerald-500" />;
    return <FileCode2 className="size-4 text-blue-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 border border-border rounded-lg p-3.5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary">
            <FolderTree className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-foreground">Dynamic Configuration Directory</span>
              <Badge variant="outline" className="font-mono text-[11px] bg-background">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">
              /etc/tako/traefik/dynamic
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reloadMutation.mutate()}
            disabled={reloadMutation.isPending}
            className="h-8 text-xs gap-1.5 active:not-aria-[haspopup]:translate-y-px"
            title="Tell Traefik on this node to reload rules immediately"
          >
            <RefreshCw
              className={`size-3.5 ${reloadMutation.isPending ? 'animate-spin text-primary' : 'text-muted-foreground'}`}
            />
            <span>Reload Traefik</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setNewFileName('');
              setCreateError(null);
              setCreateDialogOpen(true);
            }}
            className="h-8 text-xs gap-1.5 active:not-aria-[haspopup]:translate-y-px"
          >
            <Plus className="size-3.5" />
            <span>New File</span>
          </Button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: File Explorer (Sidebar) */}
        <Card className="lg:col-span-4 xl:col-span-3 border-border bg-card p-3 flex flex-col min-h-[500px]">
          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter files..."
              className="h-8 text-xs pl-8 bg-background"
            />
          </div>

          {/* Files List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {isFilesLoading && files.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-xs">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Loading files...</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No matching dynamic files found
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = file.name === selectedFileName;
                const hasUnsaved =
                  fileContents[file.name] !== undefined &&
                  fileContents[file.name] !== (savedContents[file.name] ?? '');

                return (
                  <div
                    key={file.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedFileName(file.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedFileName(file.name);
                      }
                    }}
                    className={`group w-full text-left p-2.5 rounded-md transition-colors flex items-start justify-between gap-2 border cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary/40 text-foreground font-medium'
                        : 'border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="mt-0.5 shrink-0">{getFileIcon(file.name)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate text-xs font-mono">{file.name}</span>
                          {hasUnsaved && (
                            <span
                              className="size-1.5 rounded-full bg-amber-500 shrink-0"
                              title="Unsaved changes"
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          <span>{formatFileSize(file.size)}</span>
                          <span>•</span>
                          <span className="capitalize">{file.type}</span>
                          <span>•</span>
                          <span>{file.isCustom ? 'Custom' : 'System'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delete action button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(file.name);
                      }}
                      className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title={`Delete ${file.name}`}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Presets Footer */}
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <Code2 className="size-3" />
              <span>Quick Template Presets</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewFileName('reverse-proxy.yml');
                  setSelectedTemplateKey('router');
                  setCreateError(null);
                  setCreateDialogOpen(true);
                }}
                className="h-7 text-[10px] justify-start px-2 bg-background hover:bg-muted font-normal truncate"
              >
                + Proxy Router
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewFileName('ratelimit.yml');
                  setSelectedTemplateKey('ratelimit');
                  setCreateError(null);
                  setCreateDialogOpen(true);
                }}
                className="h-7 text-[10px] justify-start px-2 bg-background hover:bg-muted font-normal truncate"
              >
                + Rate Limit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewFileName('basic-auth.yml');
                  setSelectedTemplateKey('basicauth');
                  setCreateError(null);
                  setCreateDialogOpen(true);
                }}
                className="h-7 text-[10px] justify-start px-2 bg-background hover:bg-muted font-normal truncate"
              >
                + Basic Auth
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewFileName('security-cors.yml');
                  setSelectedTemplateKey('cors');
                  setCreateError(null);
                  setCreateDialogOpen(true);
                }}
                className="h-7 text-[10px] justify-start px-2 bg-background hover:bg-muted font-normal truncate"
              >
                + CORS Headers
              </Button>
            </div>
          </div>
        </Card>

        {/* Right Column: Code Editor & Toolbar */}
        <Card className="lg:col-span-8 xl:col-span-9 border-border bg-card flex flex-col min-h-[500px]">
          {selectedFileName && activeFile ? (
            <>
              {/* Editor Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/20 px-4 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  {getFileIcon(activeFile.name)}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {activeFile.name}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono uppercase ${
                        isDirty
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                          : 'bg-status-success/10 text-status-success border-status-success/30'
                      }`}
                    >
                      {isDirty ? 'Unsaved Changes' : 'Saved'}
                    </Badge>
                  </div>
                </div>

                {/* Toolbar buttons */}
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleFormatClean}
                    className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground px-2"
                    title="Clean trailing whitespace"
                  >
                    <Sparkles className="size-3.5" />
                    <span className="hidden sm:inline">Clean</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground px-2"
                    title="Copy file content"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5 text-status-success" />
                        <span className="hidden sm:inline">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        <span className="hidden sm:inline">Copy</span>
                      </>
                    )}
                  </Button>

                  <div className="h-4 w-px bg-border mx-0.5" />

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !isDirty}
                    className="h-7 text-xs gap-1.5 px-3 active:not-aria-[haspopup]:translate-y-px"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    <span>Save File</span>
                    <span className="hidden md:inline text-[10px] opacity-60 ml-0.5">⌘S</span>
                  </Button>
                </div>
              </div>

              {/* Live Syntax-Highlighted Editor Area */}
              <div
                ref={editorContainerRef}
                className="flex flex-1 min-h-[420px] max-h-[640px] overflow-auto bg-background"
              >
                {/* Gutter with line numbers */}
                <div
                  aria-hidden="true"
                  className="select-none sticky left-0 z-10 w-12 border-r border-border bg-background py-3 pr-3 text-right font-mono text-xs shrink-0 leading-[21px]"
                >
                  {Array.from({ length: Math.max(lineCount, 1) }).map((_, idx) => (
                    <div key={idx} className="h-[21px] text-muted-foreground/40">
                      {idx + 1}
                    </div>
                  ))}
                </div>

                {/* Code editor */}
                <div className="flex-1 min-w-0 bg-background flex flex-col">
                  {isContentLoading ? (
                    <div className="flex items-center justify-center py-24 text-muted-foreground gap-2 text-xs">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span>Loading file content...</span>
                    </div>
                  ) : (
                    <Editor
                      value={currentContent}
                      onValueChange={(newVal) => {
                        if (selectedFileName) {
                          setFileContents((prev) => ({
                            ...prev,
                            [selectedFileName]: newVal,
                          }));
                        }
                      }}
                      highlight={highlightCode}
                      padding={12}
                      className="flex-1 font-mono text-xs leading-[21px] text-foreground"
                      textareaClassName="focus:outline-none bg-transparent caret-primary text-foreground placeholder:text-muted-foreground/40 placeholder:font-mono"
                      preClassName="prism-code"
                      style={{
                        fontFamily:
                          'Iosevka, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: '12px',
                        lineHeight: '21px',
                        minHeight: '420px',
                        width: '100%',
                        whiteSpace: 'pre',
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Editor Footer Status Bar */}
              <div className="flex flex-wrap items-center justify-between border-t border-border bg-muted/10 px-4 py-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-mono">
                    <CheckCircle2 className="size-3 text-status-success" />
                    {lineCount} {lineCount === 1 ? 'line' : 'lines'}
                  </span>
                  <span>•</span>
                  <span>{currentContent.length} chars</span>
                  <span>•</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Path: {activeFile.path}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-[10px]">
                  <span>Traefik Dynamic YAML</span>
                  <span>•</span>
                  <span>UTF-8</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 py-24 text-center px-4">
              <FilePlus2 className="size-10 text-muted-foreground/40 mb-3" />
              <h4 className="font-semibold text-sm text-foreground">No file selected</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Select a dynamic configuration file from the list or create a new file to configure custom Traefik routing rules.
              </p>
              <Button
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="mt-4 h-8 text-xs gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>Create New File</span>
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Modal: Create New File */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Dynamic Configuration File</DialogTitle>
            <DialogDescription>
              Create a new YAML or TOML dynamic configuration file in{' '}
              <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
                /etc/tako/traefik/dynamic
              </code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Filename</label>
              <Input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="e.g. my-custom-router.yml"
                className="h-8 text-xs font-mono"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Supported formats: <code>.yml</code>, <code>.yaml</code>, <code>.toml</code>, <code>.json</code>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Initial Template</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {Object.entries(TEMPLATES).map(([key, item]) => {
                  const isSelected = selectedTemplateKey === key;
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedTemplateKey(key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedTemplateKey(key);
                        }
                      }}
                      className={`p-2 rounded-md border text-left cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border hover:bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      <div className="text-xs font-medium text-foreground">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{item.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {createError && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-md">
                <AlertCircle className="size-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateDialogOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateFile}
              className="text-xs h-8"
            >
              Create File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Configuration File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <code className="text-xs font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-foreground">
                {deleteTarget}
              </code>
              ? This action cannot be undone and will remove the routing rules defined inside this file.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="text-xs h-8 gap-1.5"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              <span>Delete Permanently</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
