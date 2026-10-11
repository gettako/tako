'use client';

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Server,
  Lock,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { listRegistries, createRegistry, deleteRegistry } from '@/lib/api/registries';
import { Registry } from '@/lib/types/registry';

export function RegistriesPanel() {
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRegistries = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listRegistries();
      setRegistries(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load registries');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistries();
  }, []);

  const handleOpenDialog = () => {
    setName('');
    setServerUrl('');
    setUsername('');
    setPassword('');
    setDialogError(null);
    setIsDialogOpen(true);
  };

  const applyPreset = (presetName: string, url: string) => {
    setName(presetName);
    setServerUrl(url);
  };

  const handleCreateRegistry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !serverUrl.trim() || !username.trim() || !password.trim()) {
      setDialogError('All fields are required.');
      return;
    }

    setIsSubmitting(true);
    setDialogError(null);
    try {
      await createRegistry({
        name: name.trim(),
        serverUrl: serverUrl.trim(),
        username: username.trim(),
        password: password.trim(),
      });
      setIsDialogOpen(false);
      setSuccess(`Registry "${name}" successfully connected.`);
      setTimeout(() => setSuccess(null), 4000);
      await fetchRegistries();
    } catch (err: unknown) {
      setDialogError(err instanceof Error ? err.message : 'Failed to connect registry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, regName: string) => {
    if (!confirm(`Are you sure you want to delete registry "${regName}"? Services pulling from it may fail to pull new images.`)) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteRegistry(id);
      setRegistries((prev) => prev.filter((r) => r.id !== id));
      setSuccess(`Registry "${regName}" deleted.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete registry');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
              <Boxes className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground font-sans">
                Private Image Registries
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage credentials to pull container images from private Docker Hub, GitHub Packages (ghcr.io), AWS ECR, and self-hosted OCI registries.
              </p>
            </div>
          </div>

          <Button
            onClick={handleOpenDialog}
            className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="size-4" />
            Add Registry
          </Button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}
      </div>

      {/* Registries List */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Configured Registries ({registries.length})
          </h3>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            Passwords securely encrypted
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="size-5 animate-spin" />
            <span>Loading registries...</span>
          </div>
        ) : registries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-12 px-4 text-center space-y-3">
            <Boxes className="mx-auto size-10 text-muted-foreground/60" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No private registries configured</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Connect your private Docker registries to deploy proprietary containers directly without pushing to public hubs.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleOpenDialog} className="gap-1.5 mt-2">
              <Plus className="size-3.5" />
              Connect your first registry
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {registries.map((reg) => (
              <div
                key={reg.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-muted/20 p-4 transition-colors hover:border-border/80"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-sm flex items-center gap-2">
                      <Server className="size-4 text-primary shrink-0" />
                      {reg.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(reg.id, reg.name)}
                      disabled={deletingId === reg.id}
                      className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete Registry"
                    >
                      {deletingId === reg.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </div>

                  <div className="space-y-1 text-xs font-mono text-muted-foreground">
                    <div className="flex items-center gap-1.5 truncate">
                      <ExternalLink className="size-3 text-muted-foreground shrink-0" />
                      <span className="text-foreground">{reg.serverUrl}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="size-3 text-muted-foreground shrink-0" />
                      <span>{reg.username}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lock className="size-3 text-muted-foreground shrink-0" />
                      <span className="tracking-widest text-muted-foreground">••••••••</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <span>ID: <code className="font-mono text-[11px]">{reg.id}</code></span>
                  <span>{new Date(reg.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Registry Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Private Image Registry</DialogTitle>
            <DialogDescription>
              Enter credentials for pulling images directly from your private container registry.
            </DialogDescription>
          </DialogHeader>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Quick Presets:</span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={() => applyPreset('GitHub Container Registry', 'ghcr.io')}
              >
                ghcr.io (GitHub)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={() => applyPreset('Docker Hub Private', 'docker.io')}
              >
                docker.io (Docker Hub)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={() => applyPreset('Quay.io', 'quay.io')}
              >
                quay.io (Red Hat)
              </Button>
            </div>
          </div>

          <form onSubmit={handleCreateRegistry} className="space-y-4 pt-2">
            {dialogError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                {dialogError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="reg-name" className="text-xs">Display Name</Label>
              <Input
                id="reg-name"
                placeholder="e.g. GitHub Packages or Docker Hub"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-url" className="text-xs">Server URL</Label>
              <Input
                id="reg-url"
                placeholder="e.g. ghcr.io or index.docker.io/v1/"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-user" className="text-xs">Username / Access Key</Label>
              <Input
                id="reg-user"
                placeholder="e.g. octocat"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-pass" className="text-xs">Password / Personal Access Token</Label>
              <Input
                id="reg-pass"
                type="password"
                placeholder="••••••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                Connect Registry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
