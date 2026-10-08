'use client';

import React, { useState, useEffect } from 'react';
import { Service, UpdateServiceInput } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { GitBranch, GitCommit, FolderGit2, Terminal, FileCode2, Save, Undo2, Loader2, Database, Settings } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';

interface GeneralSettingsSectionProps {
  service: Service;
  onUpdate: (input: UpdateServiceInput) => Promise<void>;
}

export function GeneralSettingsSection({ service, onUpdate }: GeneralSettingsSectionProps) {
  const [name, setName] = useState(service.name);
  const [branch, setBranch] = useState(service.branch || 'main');
  const [commitHash, setCommitHash] = useState(service.commitHash || '');
  const [dockerfile, setDockerfile] = useState(service.dockerfile || 'Dockerfile');
  const [buildCommand, setBuildCommand] = useState(service.buildCommand || '');
  const [repository, setRepository] = useState(service.repository || '');
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    name !== service.name ||
    branch !== (service.branch || 'main') ||
    commitHash !== (service.commitHash || '') ||
    dockerfile !== (service.dockerfile || 'Dockerfile') ||
    buildCommand !== (service.buildCommand || '') ||
    repository !== (service.repository || '');

  useEffect(() => {
    if (!isDirty) {
      setName(service.name);
      setBranch(service.branch || 'main');
      setCommitHash(service.commitHash || '');
      setDockerfile(service.dockerfile || 'Dockerfile');
      setBuildCommand(service.buildCommand || '');
      setRepository(service.repository || '');
    }
  }, [service, isDirty]);

  const handleReset = () => {
    setName(service.name);
    setBranch(service.branch || 'main');
    setCommitHash(service.commitHash || '');
    setDockerfile(service.dockerfile || 'Dockerfile');
    setBuildCommand(service.buildCommand || '');
    setRepository(service.repository || '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Service name cannot be empty');
      return;
    }

    try {
      setIsSaving(true);
      await onUpdate({
        name: name.trim(),
        branch: branch.trim(),
        commitHash: commitHash.trim() || undefined,
        dockerfile: dockerfile.trim(),
        buildCommand: buildCommand.trim(),
        repository: repository.trim() || undefined,
      });
      toast.success('General settings saved successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update settings';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const isDatabase = service.type === 'database';

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={Settings}
            title="General Information"
            description="Basic configuration, identifiers, and build parameters for this service."
          />
        </CardHeader>

        <CardContent className="px-0 space-y-5">
          {/* Service Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Service Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. web-storefront"
              className="max-w-md font-medium text-sm"
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Internal service identifier and default DNS hostname within the Tako cluster network.
            </p>
          </div>

          {/* Type / Environment Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Service Type</span>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                {isDatabase ? (
                  <Database className="size-4 text-status-warning" />
                ) : (
                  <FileCode2 className="size-4 text-primary" />
                )}
                <span className="capitalize">{service.type}</span>
                {service.databaseType && (
                  <span className="text-muted-foreground font-mono">({service.databaseType})</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Assigned Cluster Node</span>
              <div className="text-sm font-mono text-foreground font-medium">
                {service.nodeName}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Build & Repository Settings for App / Compose */}
      {!isDatabase && (
        <Card className="border-border bg-card p-6">
          <CardHeader className="px-0 pt-0 pb-4">
            <SectionHeader
              icon={FolderGit2}
              title="Source & Build Settings"
              description="Configure the Git repository branch, Docker build context, and build instructions."
            />
          </CardHeader>

          <CardContent className="px-0 space-y-5 pb-6">
            {/* Repository */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <FolderGit2 className="size-3.5 text-muted-foreground" />
                Repository
              </Label>
              <Input
                value={repository}
                onChange={(e) => setRepository(e.target.value)}
                placeholder="e.g. gettako/storefront-next"
                className="max-w-md font-mono text-sm"
                disabled={isSaving}
              />
            </div>

            {/* Branch */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <GitBranch className="size-3.5 text-muted-foreground" />
                Target Branch
              </Label>
              <Input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="max-w-md font-mono text-sm"
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto-deployments and webhooks will listen to pushes targeting this branch.
              </p>
            </div>

            {/* Commit Hash */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <GitCommit className="size-3.5 text-muted-foreground" />
                Pinned Commit Hash (Optional)
              </Label>
              <Input
                value={commitHash}
                onChange={(e) => setCommitHash(e.target.value)}
                placeholder="e.g. 2919db3 (leave empty for latest HEAD)"
                className="max-w-md font-mono text-sm"
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pin a specific git commit hash to deploy. Leave empty to automatically build the latest HEAD on {branch || 'main'}.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Dockerfile Path */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <FileCode2 className="size-3.5 text-muted-foreground" />
                  Dockerfile Path
                </Label>
                <Input
                  value={dockerfile}
                  onChange={(e) => setDockerfile(e.target.value)}
                  placeholder="Dockerfile"
                  className="font-mono text-sm"
                  disabled={isSaving}
                />
              </div>

              {/* Build Command */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Terminal className="size-3.5 text-muted-foreground" />
                  Custom Build Command (Optional)
                </Label>
                <Input
                  value={buildCommand}
                  onChange={(e) => setBuildCommand(e.target.value)}
                  placeholder="e.g. npm run build"
                  className="font-mono text-sm"
                  disabled={isSaving}
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="px-0 pt-6 pb-0 flex items-center justify-between border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleReset}
              disabled={!isDirty || isSaving}
              className="gap-1.5 text-sm h-9 active:not-aria-[haspopup]:translate-y-px"
            >
              <Undo2 className="size-3.5" />
              Discard Changes
            </Button>

            <Button
              type="submit"
              size="default"
              disabled={!isDirty || isSaving}
              className="gap-1.5 text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium active:not-aria-[haspopup]:translate-y-px"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Save Changes
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* For databases: save button on the general card if dirty */}
      {isDatabase && (
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className="gap-1.5 text-sm h-9 active:not-aria-[haspopup]:translate-y-px"
          >
            <Undo2 className="size-3.5" />
            Discard
          </Button>

          <Button
            type="submit"
            size="default"
            disabled={!isDirty || isSaving}
            className="gap-1.5 text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium active:not-aria-[haspopup]:translate-y-px"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}
    </form>
  );
}
