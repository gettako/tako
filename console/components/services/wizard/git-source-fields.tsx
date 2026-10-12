import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FieldError } from '@/components/ui/field';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FolderGit2, GitBranch, Globe, Building2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export interface GitSourceAccount {
  id: string;
  username: string;
  avatarUrl?: string;
  type?: string;
}

export interface GitSourceRepo {
  id: string;
  fullName: string;
}

export interface GitSourceFieldsProps {
  sourceMode: 'account' | 'url';
  onSourceModeChange: (mode: 'account' | 'url') => void;
  selectedAccountId: string;
  onSelectAccountId: (id: string) => void;
  accountOptions: SearchableSelectOption[];
  availableAccounts: GitSourceAccount[];
  selectedRepoId: string;
  onSelectRepoId: (id: string) => void;
  repoOptions: SearchableSelectOption[];
  repoError?: string;
  syncedRepos: GitSourceRepo[];
  accountRepos: GitSourceRepo[];
  customGitUrl: string;
  onCustomGitUrlChange: (url: string) => void;
  urlError?: string;
  branch: string;
  onBranchChange: (branch: string) => void;
}

export function GitSourceFields({
  sourceMode,
  onSourceModeChange,
  selectedAccountId,
  onSelectAccountId,
  accountOptions,
  availableAccounts,
  selectedRepoId,
  onSelectRepoId,
  repoOptions,
  repoError,
  syncedRepos,
  accountRepos,
  customGitUrl,
  onCustomGitUrlChange,
  urlError,
  branch,
  onBranchChange,
}: GitSourceFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <FolderGit2 className="size-3.5 text-foreground" />
          <span>Git Source Repository</span>
          <span className="text-status-danger">*</span>
        </Label>

        {/* Toggle Mode: Select Account/Repo vs Git URL */}
        <div className="flex items-center p-0.5 rounded-lg border border-border bg-muted/40 text-xs">
          <button
            type="button"
            onClick={() => onSourceModeChange('account')}
            className={cn(
              'px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer text-xs active:not-aria-[haspopup]:translate-y-px',
              sourceMode === 'account'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            GitHub Account &amp; Repo
          </button>
          <button
            type="button"
            onClick={() => onSourceModeChange('url')}
            className={cn(
              'px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer text-xs active:not-aria-[haspopup]:translate-y-px',
              sourceMode === 'url'
                ? 'bg-background text-foreground shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Custom Git URL
          </button>
        </div>
      </div>

      {/* Source Input Area */}
      <div>
        {sourceMode === 'account' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Select GitHub Account / Org */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                GitHub Account / Organization
              </Label>
              <div>
                <SearchableSelect
                  options={accountOptions}
                  value={selectedAccountId || undefined}
                  onValueChange={(val) => {
                    if (!val || val === 'null' || val === 'undefined') return;
                    onSelectAccountId(String(val));
                  }}
                  placeholder="Select account or organization..."
                  searchPlaceholder="Search account or organization..."
                  className="w-full"
                  renderTrigger={(opt) => {
                    if (!opt) {
                      return (
                        <span className="text-muted-foreground font-normal">
                          Select account or organization...
                        </span>
                      );
                    }
                    if (opt.value === 'all') {
                      return (
                        <div className="flex items-center gap-2 min-w-0">
                          <Globe className="size-3.5 text-primary shrink-0" />
                          <span className="font-semibold text-xs text-foreground truncate">
                            All Organizations &amp; Accounts
                          </span>
                        </div>
                      );
                    }
                    const acc = availableAccounts.find((a) => a.id === opt.value);
                    return (
                      <div className="flex items-center gap-2 min-w-0">
                        {acc?.avatarUrl ? (
                          <Avatar className="size-4 shrink-0">
                            <AvatarImage src={acc.avatarUrl} />
                            <AvatarFallback className="text-[9px]">
                              {acc.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : acc?.type === 'Organization' ? (
                          <Building2 className="size-3.5 text-blue-500 shrink-0" />
                        ) : (
                          <User className="size-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-semibold text-xs text-foreground truncate">
                          {acc?.username || opt.label}
                        </span>
                        {acc?.type && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal text-muted-foreground shrink-0">
                            {acc.type}
                          </Badge>
                        )}
                      </div>
                    );
                  }}
                />
              </div>
            </div>

            {/* Select Repository */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Repository <span className="text-status-danger">*</span>
              </Label>
              <div>
                <SearchableSelect
                  options={repoOptions}
                  value={selectedRepoId || undefined}
                  onValueChange={(val) => {
                    if (!val || val === 'null' || val === 'undefined') {
                      onSelectRepoId('');
                    } else {
                      onSelectRepoId(String(val));
                    }
                  }}
                  placeholder="Select repository..."
                  searchPlaceholder="Search repository..."
                  emptyText={
                    accountRepos.length === 0
                      ? 'No repositories found for this account.'
                      : 'No matching repositories found.'
                  }
                  error={repoError}
                  className="w-full"
                  renderTrigger={(opt) => {
                    if (!opt) {
                      return (
                        <span className="text-muted-foreground font-normal">
                          Select repository...
                        </span>
                      );
                    }
                    const repo = syncedRepos.find((r) => r.id === opt.value);
                    return (
                      <div className="flex items-center gap-2 min-w-0">
                        <GitHubIcon className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs font-medium text-foreground truncate">
                          {repo ? repo.fullName : opt.label}
                        </span>
                      </div>
                    );
                  }}
                />
              </div>
              <FieldError error={repoError} />
            </div>
          </div>
        ) : (
          /* Custom Git URL */
          <div className="space-y-1.5">
            <Label htmlFor="custom-git-url" className="text-xs font-semibold text-foreground">
              Git Repository URL <span className="text-status-danger">*</span>
            </Label>
            <div className="relative">
              <FolderGit2 className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="custom-git-url"
                value={customGitUrl}
                onChange={(e) => onCustomGitUrlChange(e.target.value)}
                placeholder="https://github.com/organization/my-service.git"
                error={!!urlError}
                className="pl-8 h-9 text-xs sm:text-sm font-mono"
              />
            </div>
            <FieldError error={urlError} />
          </div>
        )}
      </div>

      {/* Git Branch */}
      <div className="space-y-1.5">
        <Label htmlFor="service-branch" className="text-xs font-semibold text-foreground">
          Git Branch
        </Label>
        <div className="relative">
          <GitBranch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="service-branch"
            value={branch}
            onChange={(e) => onBranchChange(e.target.value)}
            placeholder="e.g. main or master"
            className="pl-8 h-9 text-xs sm:text-sm font-mono"
          />
        </div>
      </div>
    </div>
  );
}
