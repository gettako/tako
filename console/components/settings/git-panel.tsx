'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGitProviders, getSyncedRepos, syncGitRepos } from '@/lib/api/settings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FolderGit2, CheckCircle2, RotateCw, ExternalLink, Lock, Globe, Loader2, GitBranch } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';

export function GitPanel() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: providers = [] } = useQuery({
    queryKey: ['git-providers'],
    queryFn: getGitProviders,
  });

  const { data: repos = [] } = useQuery({
    queryKey: ['synced-repos'],
    queryFn: getSyncedRepos,
  });

  const handleSyncNow = async () => {
    try {
      setIsSyncing(true);
      await syncGitRepos();
      queryClient.invalidateQueries({ queryKey: ['synced-repos'] });
      toast.success('Synced repositories updated from GitHub');
    } catch {
      toast.error('Failed to sync repositories');
    } finally {
      setIsSyncing(false);
    }
  };

  const primaryProvider = providers[0];

  return (
    <div className="space-y-6">
      {/* Connected GitHub App Card */}
      <Card className="border-border/60 bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={FolderGit2}
            title="Git Version Control Integration"
            description="Connect your GitHub organization or personal account to enable push-to-deploy pipelines and pull request previews."
          />
        </CardHeader>

        <CardContent className="px-0 pt-2">
          {primaryProvider ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border/60 bg-muted/20 gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarImage src={primaryProvider.avatarUrl} alt={primaryProvider.name} />
                  <AvatarFallback>GH</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">
                      {primaryProvider.name} ({primaryProvider.username})
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-status-success/10 text-status-success border-status-success/30 font-mono text-xs gap-1"
                    >
                      <CheckCircle2 className="size-3" />
                      App Connected
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Authorized for repository read and deployment webhook dispatch.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info('Redirecting to GitHub App settings...')}
                  className="text-sm h-9 gap-1.5"
                >
                  <span>Configure App</span>
                  <ExternalLink className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-border/60 text-center space-y-2">
              <p className="text-sm text-muted-foreground">No GitHub App connected.</p>
              <Button size="sm" className="text-sm bg-primary text-primary-foreground">
                Connect GitHub App
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Synced Repositories Card */}
      <Card className="border-border/60 bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={GitBranch}
            title="Synced Repositories"
            description="Available GitHub repositories accessible to Tako for creating services."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="text-sm h-9 gap-1.5 shrink-0"
              >
                {isSyncing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCw className="size-3.5 text-primary" />
                )}
                Sync Repositories
              </Button>
            }
          />
        </CardHeader>

        <CardContent className="px-0 pt-2">
          <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs">
            <Table>
              <TableHeader className="bg-muted/40 border-b border-border/60">
                <TableRow className="border-b border-border/60 hover:bg-transparent">
                  <TableHead className="w-[40%]">Repository</TableHead>
                  <TableHead className="w-[25%]">Default Branch</TableHead>
                  <TableHead className="w-[20%]">Visibility</TableHead>
                  <TableHead className="text-right">GitHub Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repos.map((repo) => (
                  <TableRow key={repo.id} className="h-14 border-b border-border/60 hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-foreground font-mono text-sm">
                      {repo.fullName}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      <span className="px-2 py-0.5 rounded bg-muted text-foreground">
                        {repo.defaultBranch}
                      </span>
                    </TableCell>
                    <TableCell>
                      {repo.private ? (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Lock className="size-3.5" /> Private
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Globe className="size-3.5" /> Public
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <span>View</span>
                        <ExternalLink className="size-3.5" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
