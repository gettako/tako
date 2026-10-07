'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  FolderGit2,
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
  Check,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function GitPanel() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreatingManifest, setIsCreatingManifest] = useState(false);
  const [targetOrg, setTargetOrg] = useState('');
  const [appName, setAppName] = useState('');
  const [showPermissions, setShowPermissions] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [searchRepoQuery, setSearchRepoQuery] = useState('');

  // Default app name based on hostname
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || 'Local';
      setAppName(`Takō Cloud (${host})`);
    }
  }, []);

  // Query GitHub App configuration
  const { data: githubApp, isLoading: loadingApp } = useQuery({
    queryKey: ['github-app'],
    queryFn: getGitHubAppConfig,
  });

  // Query Git Providers
  const { data: providers = [] } = useQuery({
    queryKey: ['git-providers'],
    queryFn: getGitProviders,
  });

  // Query Synced Repositories
  const { data: repos = [] } = useQuery({
    queryKey: ['synced-repos'],
    queryFn: getSyncedRepos,
  });

  // Handle Manifest Return Flow: ?code=...
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      const handleConvert = async () => {
        try {
          toast.loading('Finalizing automated GitHub App setup via manifest...', { id: 'manifest-convert' });
          const config = await convertGitHubAppManifestCode(code);
          toast.success(`GitHub App "${config.name}" configured successfully!`, { id: 'manifest-convert' });
          
          await queryClient.invalidateQueries({ queryKey: ['github-app'] });
          await queryClient.invalidateQueries({ queryKey: ['git-providers'] });
          await queryClient.invalidateQueries({ queryKey: ['synced-repos'] });

          // Clean URL without refresh
          const url = new URL(window.location.href);
          url.searchParams.delete('code');
          url.searchParams.delete('setup');
          window.history.replaceState({}, '', url.toString());

          // Prompt user to install
          if (config.installUrl) {
            toast.info('Step 2: Choose which repositories Takō can access.', {
              action: {
                label: 'Install App',
                onClick: () => window.open(config.installUrl, '_blank'),
              },
              duration: 10000,
            });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to finalize GitHub App';
          toast.error(msg, { id: 'manifest-convert' });
        }
      };
      handleConvert();
    }
  }, [searchParams, queryClient]);

  // Handle Installation Return Flow: ?installation_id=...
  useEffect(() => {
    const installationId = searchParams.get('installation_id');
    const setupAction = searchParams.get('setup_action');
    if (installationId || setupAction === 'install') {
      const handleInstall = async () => {
        try {
          toast.loading('Syncing repositories from GitHub App...', { id: 'install-sync' });
          const idNum = installationId ? parseInt(installationId, 10) : undefined;
          await syncGitHubInstallation(idNum);
          await queryClient.invalidateQueries({ queryKey: ['synced-repos'] });
          await queryClient.invalidateQueries({ queryKey: ['git-providers'] });
          toast.success('GitHub App installed and repositories synced!', { id: 'install-sync' });

          // Clean URL
          const url = new URL(window.location.href);
          url.searchParams.delete('installation_id');
          url.searchParams.delete('setup_action');
          window.history.replaceState({}, '', url.toString());
        } catch {
          toast.error('Failed to sync repositories', { id: 'install-sync' });
        }
      };
      handleInstall();
    }
  }, [searchParams, queryClient]);

  // Launch GitHub App Manifest Flow (1-Click)
  const handleLaunchManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingManifest(true);
      toast.loading('Generating GitHub App manifest and opening GitHub...', { id: 'manifest-launch' });
      const manifest = await getGitHubAppManifest(appName.trim());
      toast.dismiss('manifest-launch');
      submitGitHubAppManifestForm(manifest, targetOrg.trim());
    } catch {
      toast.error('Failed to initiate GitHub App creation', { id: 'manifest-launch' });
      setIsCreatingManifest(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      setIsSyncing(true);
      await syncGitRepos();
      await queryClient.invalidateQueries({ queryKey: ['synced-repos'] });
      toast.success('Synced repositories updated from GitHub');
    } catch {
      toast.error('Failed to sync repositories');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await disconnectGitHubApp();
      await queryClient.invalidateQueries({ queryKey: ['github-app'] });
      await queryClient.invalidateQueries({ queryKey: ['git-providers'] });
      await queryClient.invalidateQueries({ queryKey: ['synced-repos'] });
      toast.success('GitHub App disconnected');
      setDisconnectDialogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to disconnect app';
      toast.error(msg);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const primaryProvider = providers.find((p) => p.type === 'github') || providers[0];
  const isAppActive = Boolean(githubApp?.appId) || Boolean(primaryProvider?.connected);

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(searchRepoQuery.toLowerCase()) ||
      r.fullName.toLowerCase().includes(searchRepoQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* GitHub App Manifest Integration Card */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={FolderGit2}
            title="GitHub App Integration (Automated via Manifest)"
            description="Deploy services directly from GitHub, enable automatic push-to-deploy, commit status checks, and preview pull requests with zero manual secret copying."
            action={
              isAppActive && (
                <Badge
                  variant="outline"
                  className="bg-status-success/10 text-status-success border-status-success/30 font-mono text-xs gap-1.5 py-1 px-2.5"
                >
                  <span className="size-2 rounded-full bg-status-success animate-pulse" />
                  <span>GitHub App Active</span>
                </Badge>
              )
            }
          />
        </CardHeader>

        <CardContent className="px-0 pt-2">
          {isAppActive ? (
            /* Connected GitHub App View */
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-xl border border-border bg-muted/20 gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <Avatar className="size-12 border border-border bg-muted shrink-0">
                    <AvatarImage
                      src={githubApp?.owner?.avatarUrl || primaryProvider?.avatarUrl}
                      alt={githubApp?.name || primaryProvider?.name}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">GH</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-base text-foreground">
                        {githubApp?.name || primaryProvider?.name || 'Takō Cloud'}
                      </span>
                      {githubApp?.slug && (
                        <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border">
                          @{githubApp.slug}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                      <span>Owner: <strong className="text-foreground">{githubApp?.owner?.login || primaryProvider?.username || 'Authenticated'}</strong></span>
                      {githubApp?.appId && <span>App ID: <strong className="font-mono text-foreground">{githubApp.appId}</strong></span>}
                      {githubApp?.clientId && <span>Client ID: <strong className="font-mono text-foreground">{githubApp.clientId}</strong></span>}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-status-success pt-0.5">
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      <span>Webhook active (Push, Pull Request, and Deployment events routed)</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0">
                  {/* Install / Manage Repositories on GitHub */}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      const installUrl = githubApp?.installUrl || (githubApp?.slug ? `https://github.com/apps/${githubApp.slug}/installations/new` : 'https://github.com/settings/apps');
                      window.open(installUrl, '_blank');
                    }}
                    className="text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 active:not-aria-[haspopup]:translate-y-px"
                  >
                    <span>Install on Repositories</span>
                    <ExternalLink className="size-3.5" />
                  </Button>

                  {/* Open App settings on GitHub */}
                  {githubApp?.slug && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://github.com/settings/apps/${githubApp.slug}`, '_blank')}
                      className="text-xs h-9 gap-1.5 border-border hover:bg-muted active:not-aria-[haspopup]:translate-y-px"
                    >
                      <span>App Settings</span>
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                    </Button>
                  )}

                  {/* Disconnect App */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDisconnectDialogOpen(true)}
                    className="text-xs h-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Disconnect GitHub App"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Automated 1-Click Manifest Creation Form */
            <form onSubmit={handleLaunchManifest} className="space-y-5">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                    <Sparkles className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span>1-Click Automated Setup (No Manual Secret Copying)</span>
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 uppercase font-mono">
                        Manifest Flow
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      GitHub App Manifest standard lets Takō automatically generate the app configuration, webhook URLs, and permissions. You only click <strong>"Create GitHub App"</strong> on GitHub, and Takō automatically receives the credentials, RSA private key, and webhook secret!
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* App Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="app-name-input" className="text-xs font-medium text-foreground">
                      GitHub App Name
                    </Label>
                    <Input
                      id="app-name-input"
                      type="text"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="Takō Cloud (Production)"
                      className="text-xs h-9 bg-background font-mono"
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">The display name of the app shown in your GitHub account.</p>
                  </div>

                  {/* Organization (Optional) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="target-org-input" className="text-xs font-medium text-foreground">
                      Target GitHub Organization <span className="text-muted-foreground font-normal">(Optional)</span>
                    </Label>
                    <Input
                      id="target-org-input"
                      type="text"
                      value={targetOrg}
                      onChange={(e) => setTargetOrg(e.target.value)}
                      placeholder="e.g. acme-corp (leave blank for personal)"
                      className="text-xs h-9 bg-background font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">Leave empty to register under your personal GitHub profile.</p>
                  </div>
                </div>

                {/* Collapsible Permissions Preview */}
                <div className="pt-2 border-t border-primary/15">
                  <button
                    type="button"
                    onClick={() => setShowPermissions(!showPermissions)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
                  >
                    <ShieldCheck className="size-3.5" />
                    <span>View requested permissions & events</span>
                    {showPermissions ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </button>

                  {showPermissions && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-lg bg-background/80 border border-border text-xs">
                      <div>
                        <strong className="text-foreground block mb-1">Repository Permissions:</strong>
                        <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                          <li><strong>Contents:</strong> Read (clone repository code)</li>
                          <li><strong>Metadata:</strong> Read (search repos & branches)</li>
                          <li><strong>Pull Requests:</strong> Read (PR preview environments)</li>
                          <li><strong>Commit Statuses:</strong> Write (report build pass/fail)</li>
                          <li><strong>Deployments:</strong> Write (report deployment statuses)</li>
                        </ul>
                      </div>
                      <div>
                        <strong className="text-foreground block mb-1">Webhook Subscriptions:</strong>
                        <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                          <li><strong>push:</strong> Auto-deploy services on new commits</li>
                          <li><strong>pull_request:</strong> Ephemeral review environments</li>
                          <li><strong>installation:</strong> Auto-sync permitted repos</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  You will be redirected to GitHub to confirm. After confirmation, you'll be redirected back automatically.
                </p>

                <Button
                  type="submit"
                  size="default"
                  disabled={isCreatingManifest || !appName.trim()}
                  className="text-sm h-10 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 shrink-0 active:not-aria-[haspopup]:translate-y-px shadow-sm"
                >
                  {isCreatingManifest ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <GitHubIcon className="size-4" />
                  )}
                  <span>Create GitHub App via 1-Click Manifest</span>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Synced Repositories Card */}
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={GitBranch}
            title="Synced Repositories"
            description="Repositories authorized for Takō Cloud to clone, build, and deploy containerized services."
            action={
              <div className="flex items-center gap-2">
                {/* Search repos */}
                <div className="relative w-48 sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Search repositories..."
                    value={searchRepoQuery}
                    onChange={(e) => setSearchRepoQuery(e.target.value)}
                    className="h-9 pl-8 text-xs font-mono bg-muted/20"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="text-sm h-9 gap-1.5 shrink-0 active:not-aria-[haspopup]:translate-y-px"
                >
                  {isSyncing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="size-3.5 text-primary" />
                  )}
                  <span>Sync Repositories</span>
                </Button>
              </div>
            }
          />
        </CardHeader>

        <CardContent className="px-0 pt-2">
          {filteredRepos.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-border text-sm text-muted-foreground space-y-2">
              <FolderGit2 className="size-8 mx-auto text-muted-foreground/60" />
              <p>No repositories found {searchRepoQuery ? `matching "${searchRepoQuery}"` : ''}.</p>
              {isAppActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const installUrl = githubApp?.installUrl || (githubApp?.slug ? `https://github.com/apps/${githubApp.slug}/installations/new` : 'https://github.com/settings/apps');
                    window.open(installUrl, '_blank');
                  }}
                  className="text-xs gap-1.5"
                >
                  <span>Grant Access to Repositories on GitHub</span>
                  <ExternalLink className="size-3" />
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40 border-b border-border">
                  <TableRow className="h-10 hover:bg-transparent">
                    <TableHead className="w-[45%]">Repository</TableHead>
                    <TableHead className="w-[20%]">Default Branch</TableHead>
                    <TableHead className="w-[15%]">Visibility</TableHead>
                    <TableHead className="text-right">GitHub Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRepos.map((repo) => (
                    <TableRow key={repo.id} className="h-14 border-b border-border hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-foreground font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <GitHubIcon className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="font-semibold text-foreground">{repo.fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        <span className="px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border">
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
                        <a
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          <span>View on GitHub</span>
                          <ExternalLink className="size-3" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect GitHub App Confirmation Dialog */}
      <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <DialogContent className="max-w-md border-destructive/30">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-destructive">
              Disconnect GitHub App?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              Disconnecting the GitHub App will revoke Takō's access to pull code from private repositories and will stop automated push-to-deploy webhooks. Running services will continue running with their existing container images.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDisconnectDialogOpen(false)}
              disabled={isDisconnecting}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="text-xs h-9 font-medium gap-1.5"
            >
              {isDisconnecting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              <span>Disconnect App</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
