'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Tag as TagIcon,
  X,
  Plus,
  Check,
  Globe,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { updateProject } from '@/lib/api/projects';
import { Project, UpdateProjectInput } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface EditProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (updatedProject: Project) => void;
}

const ENV_OPTIONS: Array<{
  id: 'production' | 'staging' | 'development';
  label: string;
  description: string;
  indicatorColor: string;
}> = [
  {
    id: 'production',
    label: 'Production',
    description: 'Live mission-critical workloads',
    indicatorColor: 'bg-status-success',
  },
  {
    id: 'staging',
    label: 'Staging',
    description: 'Pre-release QA & integration',
    indicatorColor: 'bg-status-warning',
  },
  {
    id: 'development',
    label: 'Development',
    description: 'Dev sandboxes & prototyping',
    indicatorColor: 'bg-status-info',
  },
];

const SUGGESTED_TAGS = ['web', 'api', 'worker', 'database', 'internal'];

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: EditProjectDialogProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(project.name);
  const [slug, setSlug] = useState(project.slug);
  const [description, setDescription] = useState(project.description || '');
  const [environment, setEnvironment] = useState<'production' | 'staging' | 'development'>(
    project.environment || 'production'
  );
  const [tags, setTags] = useState<string[]>(project.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [nameError, setNameError] = useState('');
  const [slugError, setSlugError] = useState('');

  // Sync state whenever dialog opens or project prop changes
  useEffect(() => {
    if (open && project) {
      setName(project.name);
      setSlug(project.slug);
      setDescription(project.description || '');
      setEnvironment(project.environment || 'production');
      setTags(project.tags ? [...project.tags] : []);
      setTagInput('');
      setNameError('');
      setSlugError('');
    }
  }, [open, project]);

  const validateSlug = (val: string): boolean => {
    if (!val.trim()) {
      setSlugError('Slug identifier is required');
      return false;
    }
    if (val.length < 2) {
      setSlugError('Slug must be at least 2 characters');
      return false;
    }
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(val)) {
      setSlugError('Slug can only contain lowercase letters, numbers, and hyphens');
      return false;
    }
    setSlugError('');
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (nameError) setNameError('');
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(val);
    validateSlug(val);
  };

  const handleAddTag = (tagToAdd?: string) => {
    const candidate = (tagToAdd || tagInput).trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!candidate) return;

    if (tags.length >= 6) {
      toast.error('Maximum 6 tags allowed per project');
      return;
    }

    if (tags.includes(candidate)) {
      setTagInput('');
      return;
    }

    setTags([...tags, candidate]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const editMutation = useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(project.id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      queryClient.invalidateQueries({ queryKey: ['project', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['project', updated.slug] });
      toast.success(`Project "${updated.name}" updated successfully`);
      onOpenChange(false);
      onSuccess?.(updated);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update project');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;
    if (!name.trim()) {
      setNameError('Project name is required');
      hasError = true;
    } else if (name.trim().length < 2) {
      setNameError('Project name must be at least 2 characters');
      hasError = true;
    }

    if (!validateSlug(slug)) {
      hasError = true;
    }

    if (hasError) return;

    editMutation.mutate({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      environment,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground font-sans">
            Edit Project
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Update project name, identifier slug, description, and environment configuration.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Project Name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-project-name" className="text-xs font-semibold text-foreground">
                Project Name <span className="text-status-danger">*</span>
              </Label>
              <span className="text-[11px] text-muted-foreground">Human-friendly title</span>
            </div>
            <Input
              id="edit-project-name"
              type="text"
              placeholder="e.g. Acme API Gateway"
              value={name}
              onChange={handleNameChange}
              disabled={editMutation.isPending}
              aria-invalid={!!nameError}
              autoFocus
              className="h-9.5 text-sm"
            />
            {nameError && (
              <p className="text-xs font-medium text-status-danger mt-1">
                {nameError}
              </p>
            )}
          </div>

          {/* Project Slug */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-project-slug" className="text-xs font-semibold text-foreground">
                Project Slug / Identifier <span className="text-status-danger">*</span>
              </Label>
              <span className="text-[11px] text-muted-foreground font-mono">lowercase & hyphens</span>
            </div>
            <Input
              id="edit-project-slug"
              type="text"
              placeholder="acme-api-gateway"
              value={slug}
              onChange={handleSlugChange}
              disabled={editMutation.isPending}
              aria-invalid={!!slugError}
              className="h-9.5 text-sm font-mono"
            />
            {slugError ? (
              <p className="text-xs font-medium text-status-danger mt-1">
                {slugError}
              </p>
            ) : (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-1.5 flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span className="truncate flex items-center gap-1.5">
                  <Globe className="size-3 shrink-0 text-muted-foreground/80" />
                  <span>/projects/</span>
                  <span className="text-foreground font-semibold">
                    {slug || 'project-slug'}
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground/60 shrink-0 uppercase tracking-wider">
                  route identifier
                </span>
              </div>
            )}
          </div>

          {/* Environment Tier */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Environment Tier
              </Label>
              <span className="text-[11px] text-muted-foreground">Workload staging level</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ENV_OPTIONS.map((env) => {
                const isSelected = environment === env.id;
                return (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => setEnvironment(env.id)}
                    disabled={editMutation.isPending}
                    className={cn(
                      'flex flex-col text-left p-3 rounded-lg border transition-all cursor-pointer active:not-aria-[haspopup]:translate-y-px outline-none',
                      isSelected
                        ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/40'
                        : 'border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('size-1.5 rounded-full', env.indicatorColor)} />
                        <span
                          className={cn(
                            'text-xs font-semibold',
                            isSelected ? 'text-foreground' : 'text-foreground/80'
                          )}
                        >
                          {env.label}
                        </span>
                      </div>
                      {isSelected && <Check className="size-3 text-primary" />}
                    </div>
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      {env.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-project-description" className="text-xs font-semibold text-foreground">
                Description
              </Label>
              <span className="text-[11px] text-muted-foreground">Optional summary</span>
            </div>
            <Textarea
              id="edit-project-description"
              placeholder="Core storefront, checkout API gateway, and PostgreSQL cluster..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={editMutation.isPending}
              rows={3}
              className="resize-none text-xs sm:text-sm"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">
                Tags / Labels
              </Label>
              <span className="text-[11px] text-muted-foreground">Up to 6 tags</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <TagIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/70 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Type tag and press Enter..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  disabled={editMutation.isPending || tags.length >= 6}
                  className="pl-8 h-8 text-xs font-mono"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddTag()}
                disabled={!tagInput.trim() || editMutation.isPending || tags.length >= 6}
                className="h-8 px-2.5 text-xs gap-1 cursor-pointer active:not-aria-[haspopup]:translate-y-px"
              >
                <Plus className="size-3" />
                <span>Add</span>
              </Button>
            </div>

            {/* Quick Suggested Tags */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] text-muted-foreground mr-1">Suggestions:</span>
              {SUGGESTED_TAGS.map((suggested) => {
                const isAdded = tags.includes(suggested);
                return (
                  <button
                    key={suggested}
                    type="button"
                    onClick={() => handleAddTag(suggested)}
                    disabled={isAdded || editMutation.isPending || tags.length >= 6}
                    className={cn(
                      'text-[11px] font-mono px-2 py-0.5 rounded-md border transition-colors cursor-pointer active:not-aria-[haspopup]:translate-y-px',
                      isAdded
                        ? 'border-border bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
                        : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    +{suggested}
                  </button>
                );
              })}
            </div>

            {/* Current Active Tags List */}
            {tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="gap-1 pl-2 pr-1 py-0.5 text-xs font-mono bg-muted/40 border-border"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      disabled={editMutation.isPending}
                      className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={editMutation.isPending}
              className="text-xs sm:text-sm h-9 cursor-pointer active:not-aria-[haspopup]:translate-y-px"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={editMutation.isPending || !name.trim()}
              className="text-xs sm:text-sm h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer active:not-aria-[haspopup]:translate-y-px gap-1.5"
            >
              {editMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
