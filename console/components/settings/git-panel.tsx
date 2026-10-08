'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getGitProviders, getSyncedRepos, syncGitRepos } from '@/lib/api/settings';
import {
  getGitHubAppConfig,
  getGitHubAppManifest,
  submitGitHubAppManifestForm,
  convertGitHubAppManifestCode,
  syncGitHubInstallation,
  disconnectGitHubApp,
} from '@/lib/api/github';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle2,
  RotateCw,
  ExternalLink,
  Lock,
  Globe,
  Loader2,
  GitBranch,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Trash2,
  Search,
  RefreshCw,
  Plus,
  FolderGit2,
  PlugZap,
  Building2,
  User,
  Settings,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';

/* ─── Icons ──────────────────────────────────────────────────────────────── */

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function GitLabIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
    </svg>
  );
}

function GiteaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.955 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.045 0zm-.04 2.328a10 10 0 0 1 .085 0 10 10 0 0 1 10 10 10 10 0 0 1-10 10 10 10 0 0 1-10-10 10 10 0 0 1 9.916-10zM10.5 6.857C8.398 6.857 6.69 8.565 6.69 10.667v5.41a.756.756 0 0 0 .757.755h5.45a.756.756 0 0 0 .756-.756v-1.512a.756.756 0 0 0-.757-.756H9.453v-2.94c0-.836.677-1.513 1.513-1.513h3.028a.756.756 0 0 0 .756-.755V7.612a.756.756 0 0 0-.756-.756z" />
    </svg>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function GitPanel() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [connectOpen, setConnectOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [isCreatingManifest, setIsCreatingManifest] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [appName, setAppName] = useState('Tako');
  const [appSlug, setAppSlug] = useState('');
  const [targetOrg, setTargetOrg] = useState('');
  const [showPerms, setShowPerms] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string>('all');

  const generateSlug = () => `tako-${Math.floor(10000 + Math.random() * 90000)}`;

  useEffect(() => { setAppSlug(generateSlug()); }, []);
  useEffect(() => { if (!connectOpen) { setIsCreatingManifest(false); setShowPerms(false); } }, [connectOpen]);

  /* Queries */
  const { data: githubApp } = useQuery({ queryKey: ['github-app'], queryFn: getGitHubAppConfig });
  const { data: providers = [] } = useQuery({ queryKey: ['git-providers'], queryFn: getGitProviders });
  const { data: repos = [] } = useQuery({ queryKey: ['synced-repos'], queryFn: getSyncedRepos });

  const primaryProvider = providers.find((p) => p.type === 'github') || providers[0];
  const isGitHubConnected = Boolean(githubApp?.appId) || Boolean(primaryProvider?.connected);

  const installations = githubApp?.installations || [];

  const displayInstallations = useMemo(() => {
    if (installations.length > 0) return installations;
    if (githubApp?.owner) {
      return [
        {
          id: githubApp.installationId || 0,
          account: githubApp.owner,
          repositorySelection: 'all' as const,
        },
      ];
    }
    if (primaryProvider?.username) {
      return [
        {
          id: 0,
          account: {
            login: primaryProvider.username,
            avatarUrl: primaryProvider.avatarUrl,
            type: 'User',
          },
          repositorySelection: 'all' as const,
        },
      ];
    }
    return [];
  }, [installations, githubApp, primaryProvider]);

  const orgs = useMemo(() => {
    const set = new Set<string>();
    repos.forEach((r) => {
      const org = r.account || (r.fullName ? r.fullName.split('/')[0] : '');
      if (org) set.add(org);
    });
    return Array.from(set).sort();
  }, [repos]);

  const getRepoCountForAccount = (login: string) => {
    return repos.filter((r) => {
      const account = r.account || (r.fullName ? r.fullName.split('/')[0] : '');
      return account.toLowerCase() === login.toLowerCase();
    }).length;
  };

  const filteredRepos = useMemo(() => {
    return repos.filter((r) => {
      const account = r.account || (r.fullName ? r.fullName.split('/')[0] : '');
      const matchesOrg = selectedOrg === 'all' || account.toLowerCase() === selectedOrg.toLowerCase();
      const matchesSearch =
        !searchQ ||
        r.name.toLowerCase().includes(searchQ.toLowerCase()) ||
        r.fullName.toLowerCase().includes(searchQ.toLowerCase());
      return matchesOrg && matchesSearch;
    });
  }, [repos, selectedOrg, searchQ]);

  /* Handle manifest return ?code= */
  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) return;
    (async () => {
      try {
        toast.loading('Finalizing GitHub App setup...', { id: 'mconv' });
        const config = await convertGitHubAppManifestCode(code);
        toast.success(`GitHub App "${config.name}" is ready!`, { id: 'mconv' });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['github-app'] }),
          queryClient.invalidateQueries({ queryKey: ['git-providers'] }),
          queryClient.invalidateQueries({ queryKey: ['synced-repos'] }),
        ]);
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('setup');
        window.history.replaceState({}, '', url.toString());
        if (config.installUrl) {
          toast.info('Step 2: Grant access to your repositories on GitHub.', {
            action: { label: 'Install App', onClick: () => window.open(config.installUrl, '_blank') },
            duration: 12000,
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to finalize GitHub App', { id: 'mconv' });
      }
    })();
  }, [searchParams, queryClient]);

  /* Handle installation return ?installation_id= */
  useEffect(() => {
    const installId = searchParams.get('installation_id');
    const action = searchParams.get('setup_action');
    if (!installId && action !== 'install') return;
    (async () => {
      try {
        toast.loading('Syncing repositories...', { id: 'isync' });
        await syncGitHubInstallation(installId ? parseInt(installId, 10) : undefined);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['github-app'] }),
          queryClient.invalidateQueries({ queryKey: ['synced-repos'] }),
          queryClient.invalidateQueries({ queryKey: ['git-providers'] }),
        ]);
        toast.success('Repositories synced!', { id: 'isync' });
        const url = new URL(window.location.href);
        url.searchParams.delete('installation_id');
        url.searchParams.delete('setup_action');
        window.history.replaceState({}, '', url.toString());
      } catch {
        toast.error('Failed to sync repositories', { id: 'isync' });
      }
    })();
  }, [searchParams, queryClient]);

  /* Actions */
  const handleLaunchManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingManifest(true);
      const slug = appSlug.trim() || generateSlug();
      const name = appName.trim() || 'Tako';
      const manifest = await getGitHubAppManifest(name, slug);
      submitGitHubAppManifestForm(manifest, targetOrg.trim());
    } catch {
      toast.error('Failed to initiate GitHub App creation');
      setIsCreatingManifest(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncGitRepos();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['github-app'] }),
        queryClient.invalidateQueries({ queryKey: ['synced-repos'] }),
      ]);
      toast.success('Repositories synced');
    } catch {
      toast.error('Failed to sync');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectGitHubApp();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['github-app'] }),
        queryClient.invalidateQueries({ queryKey: ['git-providers'] }),
        queryClient.invalidateQueries({ queryKey: ['synced-repos'] }),
      ]);
      toast.success('GitHub App disconnected');
      setDisconnectOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* ── Connected Accounts ───────────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={PlugZap}
          title="Connected Accounts"
          description="Git provider accounts authorized to deploy services."
          action={
            <Button size="sm" onClick={() => setConnectOpen(true)} className="h-9 text-xs gap-1.5">
              <Plus className="size-3.5" />
              Connect
            </Button>
          }
        />

        <div className="mt-4">
          {isGitHubConnected ? (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* App Overview Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 border-b border-border/60 bg-muted/20">
                <div className="flex items-center gap-3.5">
                  <div className="size-10 rounded-xl bg-foreground/5 border border-border flex items-center justify-center shrink-0">
                    <GitHubIcon className="size-5 text-foreground" />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {githubApp?.name || 'GitHub App'}
                      </span>
                      {githubApp?.slug && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border">
                          {githubApp.slug}
                        </span>
                      )}
                      <Badge variant="outline" className="bg-status-success/10 text-status-success border-status-success/30 text-[10px] font-mono gap-1 py-0.5 px-2">
                        <span className="size-1.5 rounded-full bg-status-success animate-pulse" />
                        Active
                      </Badge>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/25 text-[10px] font-mono gap-1 py-0.5 px-2">
                        <Globe className="size-2.5" />
                        Multi-Org
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-status-success" />
                        Webhook active
                      </span>
                      {githubApp?.appId && (
                        <span>
                          App ID: <strong className="font-mono text-foreground">{githubApp.appId}</strong>
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        {displayInstallations.length} connected {displayInstallations.length === 1 ? 'account' : 'accounts/orgs'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {githubApp?.slug && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const settingsUrl = githubApp?.owner?.type === 'Organization'
                          ? `https://github.com/organizations/${githubApp.owner.login}/settings/apps/${githubApp.slug}/advanced`
                          : `https://github.com/settings/apps/${githubApp.slug}/advanced`;
                        window.open(settingsUrl, '_blank');
                      }}
                      className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      title="Open GitHub App Advanced Settings"
                    >
                      <Settings className="size-3" />
                      App Settings
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      const installUrl = githubApp?.slug
                        ? `https://github.com/apps/${githubApp.slug}/installations/new`
                        : (githubApp?.installUrl || 'https://github.com/apps');
                      window.open(installUrl, '_blank');
                    }}
                    className="h-8 text-xs gap-1.5 font-medium shadow-sm"
                  >
                    <Building2 className="size-3.5" />
                    + Install to another Org
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDisconnectOpen(true)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Disconnect GitHub App"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Connected Organizations & Accounts List */}
              <div className="divide-y divide-border/60">
                {displayInstallations.map((inst) => {
                  const isOrg = inst.account?.type === 'Organization';
                  const repoCount = getRepoCountForAccount(inst.account?.login || '');
                  const manageUrl = isOrg
                    ? `https://github.com/organizations/${inst.account.login}/settings/installations/${inst.id}`
                    : `https://github.com/settings/installations/${inst.id}`;

                  return (
                    <div
                      key={inst.id || inst.account?.login}
                      className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="size-8 border border-border shrink-0">
                          <AvatarImage src={inst.account?.avatarUrl} />
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                            {inst.account?.login?.slice(0, 2).toUpperCase() || 'GH'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-xs text-foreground truncate">
                              {inst.account?.login}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] py-0 px-1.5 h-4 gap-1 font-normal text-muted-foreground"
                            >
                              {isOrg ? (
                                <Building2 className="size-2.5 text-blue-500" />
                              ) : (
                                <User className="size-2.5 text-muted-foreground" />
                              )}
                              {isOrg ? 'Organization' : 'Personal'}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {repoCount} {repoCount === 1 ? 'repository' : 'repositories'} synced
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {inst.id ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(manageUrl, '_blank')}
                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          >
                            Configure <ExternalLink className="size-3" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const installUrl = githubApp?.slug
                                ? `https://github.com/apps/${githubApp.slug}/installations/new`
                                : (githubApp?.installUrl || 'https://github.com/apps');
                              window.open(installUrl, '_blank');
                            }}
                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          >
                            Manage <ExternalLink className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Public Status Notice */}
              <div className="px-5 py-2.5 bg-muted/15 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Globe className="size-3 text-primary shrink-0" />
                  <span>
                    Pastikan status GitHub App adalah <strong>Public</strong> agar bisa di-install ke organisasi lain (jika Private, GitHub akan mengalihkan ke instalasi pribadi).
                  </span>
                </span>
                {githubApp?.slug && (
                  <a
                    href={
                      githubApp?.owner?.type === 'Organization'
                        ? `https://github.com/organizations/${githubApp.owner.login}/settings/apps/${githubApp.slug}/advanced`
                        : `https://github.com/settings/apps/${githubApp.slug}/advanced`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline font-medium inline-flex items-center gap-1 shrink-0"
                  >
                    Buka Pengaturan App di GitHub <ExternalLink className="size-2.5" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-10 rounded-xl border border-dashed border-border text-center">
              <div className="p-3 rounded-xl bg-muted/60">
                <PlugZap className="size-6 text-muted-foreground/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No accounts connected</p>
                <p className="text-xs text-muted-foreground mt-0.5">Connect a Git provider to enable push-to-deploy.</p>
              </div>
              <Button size="sm" onClick={() => setConnectOpen(true)} className="h-8 text-xs gap-1.5 mt-1">
                <Plus className="size-3.5" />
                Connect Provider
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Repositories ─────────────────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={GitBranch}
          title="Repositories"
          description="Repositories authorized for Takō to clone, build, and deploy."
          action={
            <div className="flex items-center gap-2">
              <div className="relative w-52">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search..."
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  className="h-9 pl-8 text-xs font-mono bg-muted/20"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleSync}
                disabled={isSyncing || !isGitHubConnected} className="h-9 gap-1.5 text-xs">
                {isSyncing ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
                Sync
              </Button>
            </div>
          }
        />

        {/* Organization / Account Filter Pills */}
        {isGitHubConnected && orgs.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-1">
            <span className="text-[11px] text-muted-foreground font-medium mr-1">Filter by account:</span>
            <Button
              variant={selectedOrg === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedOrg('all')}
              className="h-7 text-xs px-2.5 rounded-full"
            >
              All ({repos.length})
            </Button>
            {orgs.map((org) => {
              const count = repos.filter(
                (r) => (r.account || (r.fullName ? r.fullName.split('/')[0] : '')).toLowerCase() === org.toLowerCase()
              ).length;
              return (
                <Button
                  key={org}
                  variant={selectedOrg.toLowerCase() === org.toLowerCase() ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedOrg(org)}
                  className="h-7 text-xs px-2.5 rounded-full gap-1.5"
                >
                  <Building2 className="size-3 opacity-70" />
                  {org} ({count})
                </Button>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          {filteredRepos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2.5 p-10 rounded-xl border border-dashed border-border text-center">
              <FolderGit2 className="size-8 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {searchQ || selectedOrg !== 'all' ? 'No matching repositories found' : 'No repositories synced'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isGitHubConnected
                    ? 'Install the GitHub App on your personal account or organizations to grant access.'
                    : 'Connect a provider above first.'}
                </p>
              </div>
              {isGitHubConnected && !searchQ && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(githubApp?.installUrl || `https://github.com/apps/${githubApp?.slug}/installations/new`, '_blank')}
                  className="h-8 text-xs gap-1.5 mt-1"
                >
                  <Building2 className="size-3" />
                  Install to an Organization / Account <ExternalLink className="size-3" />
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40 border-b border-border">
                  <TableRow className="h-10 hover:bg-transparent">
                    <TableHead>Repository</TableHead>
                    <TableHead className="w-40">Account / Org</TableHead>
                    <TableHead className="w-28">Branch</TableHead>
                    <TableHead className="w-28">Visibility</TableHead>
                    <TableHead className="w-20 text-right">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRepos.map((repo) => {
                    const repoOwner = repo.account || (repo.fullName ? repo.fullName.split('/')[0] : '');
                    return (
                      <TableRow key={repo.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2 py-1">
                            <GitHubIcon className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="font-mono text-sm font-medium text-foreground">{repo.name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground hidden sm:inline">
                              ({repo.fullName})
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px] font-mono gap-1 text-muted-foreground bg-muted/30">
                            <Building2 className="size-2.5" />
                            {repoOwner}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted/60 border border-border text-foreground">
                            {repo.defaultBranch}
                          </span>
                        </TableCell>
                        <TableCell>
                          {repo.private ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                              <Lock className="size-3" /> Private
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              <Globe className="size-3" /> Public
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <a href={repo.htmlUrl} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            View <ExternalLink className="size-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          Connect Modal — tabs per provider
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Connect Git Provider</DialogTitle>
            <DialogDescription className="text-xs">
              Choose a provider and configure the integration below.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="github" className="mt-1">
            <TabsList className="w-full grid grid-cols-3 h-9">
              <TabsTrigger value="github" className="text-xs gap-1.5">
                <GitHubIcon className="size-3.5" />
                GitHub
              </TabsTrigger>
              <TabsTrigger value="gitlab" disabled className="text-xs gap-1.5 opacity-50">
                <GitLabIcon className="size-3.5" />
                GitLab
              </TabsTrigger>
              <TabsTrigger value="gitea" disabled className="text-xs gap-1.5 opacity-50">
                <GiteaIcon className="size-3.5" />
                Gitea
              </TabsTrigger>
            </TabsList>

            {/* ── GitHub Tab ── */}
            <TabsContent value="github" className="mt-4">
              <form onSubmit={handleLaunchManifest} className="space-y-4">
                <div className="flex items-start gap-3 px-3.5 py-3 rounded-xl border border-primary/25 bg-primary/5">
                  <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                    <p>
                      GitHub App Manifest automatically configures webhooks, permissions, and secrets with <strong>Multi-Org (Public)</strong> support.
                    </p>
                    <p className="text-[11px] text-muted-foreground/80">
                      Once created, you can install this app to your personal account and any GitHub organizations you manage.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gh-name" className="text-xs font-medium">App Name</Label>
                  <Input id="gh-name" value={appName} onChange={(e) => setAppName(e.target.value)}
                    placeholder="Tako" className="h-9 text-xs font-mono" required />
                  <p className="text-[10px] text-muted-foreground">Display name shown in your GitHub account.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    App Slug <span className="font-normal text-muted-foreground">(Auto-generated)</span>
                  </Label>
                  <div className="flex gap-1.5">
                    <div className="flex-1 flex items-center h-9 px-3 rounded-md border border-border bg-muted/30 font-mono text-xs text-foreground select-all">
                      {appSlug}
                    </div>
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0"
                      onClick={() => setAppSlug(generateSlug())} title="Regenerate">
                      <RefreshCw className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Unique identifier for the GitHub App URL.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gh-org" className="text-xs font-medium">
                    App Owner Organization <span className="font-normal text-muted-foreground">(Optional)</span>
                  </Label>
                  <Input id="gh-org" value={targetOrg} onChange={(e) => setTargetOrg(e.target.value)}
                    placeholder="e.g. acme-corp (leave blank for personal)" className="h-9 text-xs font-mono" />
                  <p className="text-[10px] text-muted-foreground">Account/org where this GitHub App is registered. You can install it into any other orgs later.</p>
                </div>

                <div className="border-t border-border pt-3">
                  <button type="button" onClick={() => setShowPerms(!showPerms)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                    <ShieldCheck className="size-3.5" />
                    View permissions &amp; events
                    {showPerms ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </button>
                  {showPerms && (
                    <div className="mt-3 grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/40 border border-border text-xs">
                      <div>
                        <p className="font-semibold text-foreground mb-1">Permissions</p>
                        <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
                          <li>Contents: Read</li>
                          <li>Metadata: Read</li>
                          <li>Pull Requests: Read</li>
                          <li>Statuses: Write</li>
                          <li>Deployments: Write</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground mb-1">Events</p>
                        <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
                          <li>push</li>
                          <li>pull_request</li>
                          <li className="text-[11px] text-muted-foreground/80">installation (automatic)</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setConnectOpen(false)} className="text-xs h-9">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isCreatingManifest || !appName.trim()}
                    className="flex-1 text-xs h-9 gap-2 font-semibold">
                    {isCreatingManifest
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <GitHubIcon className="size-3.5" />
                    }
                    Create GitHub App
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            {/* ── GitLab Tab (coming soon) ── */}
            <TabsContent value="gitlab" className="mt-4">
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="p-3 rounded-xl bg-muted/60">
                  <GitLabIcon className="size-8 text-orange-500" />
                </div>
                <p className="text-sm font-medium text-foreground">GitLab — Coming soon</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  GitLab integration via OAuth application and webhook will be available in a future update.
                </p>
              </div>
            </TabsContent>

            {/* ── Gitea Tab (coming soon) ── */}
            <TabsContent value="gitea" className="mt-4">
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="p-3 rounded-xl bg-muted/60">
                  <GiteaIcon className="size-8 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-foreground">Gitea — Coming soon</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Gitea integration via personal access token will be available in a future update.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── Disconnect Confirmation ───────────────────────────────────────── */}
      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent className="max-w-sm border-destructive/30">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-destructive">Disconnect GitHub?</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed pt-1">
              This revokes repository access and stops automated push-to-deploy webhooks.
              Running services keep their existing images.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="sm" disabled={isDisconnecting} onClick={() => setDisconnectOpen(false)} className="text-xs h-9">
              Cancel
            </Button>
            <Button variant="destructive" size="sm" disabled={isDisconnecting} onClick={handleDisconnect} className="text-xs h-9 gap-1.5">
              {isDisconnecting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
