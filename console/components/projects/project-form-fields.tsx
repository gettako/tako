'use client';

import React, { useState } from 'react';
import { Tag as TagIcon, X, Plus, Check, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export interface ProjectFormData {
  name: string;
  slug: string;
  description: string;
  environment: 'production' | 'staging' | 'development';
  tags: string[];
}

export interface ProjectFormErrors {
  name?: string;
  slug?: string;
  description?: string;
  [key: string]: string | undefined;
}

export const ENV_OPTIONS: Array<{
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

export const SUGGESTED_TAGS = ['web', 'api', 'worker', 'database', 'internal'];

export function generateSlugFromName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function validateSlug(val: string): boolean {
  if (!val || !val.trim()) return false;
  if (val.length < 2) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val);
}

export interface ProjectFormFieldsProps {
  formData: ProjectFormData;
  onChange: (updater: (prev: ProjectFormData) => ProjectFormData) => void;
  errors: ProjectFormErrors;
  setErrors: React.Dispatch<React.SetStateAction<ProjectFormErrors>>;
  isSubmitting?: boolean;
  isEditMode?: boolean;
}

export function ProjectFormFields({
  formData,
  onChange,
  errors,
  setErrors,
  isSubmitting = false,
  isEditMode = false,
}: ProjectFormFieldsProps) {
  const [tagInput, setTagInput] = useState('');
  const [isSlugTouched, setIsSlugTouched] = useState(isEditMode);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    onChange((prev) => {
      const next = { ...prev, name: newName };
      if (!isSlugTouched && !isEditMode) {
        next.slug = generateSlugFromName(newName);
      }
      return next;
    });

    if (errors.name && newName.trim()) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugTouched(true);
    const sanitized = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');

    onChange((prev) => ({ ...prev, slug: sanitized }));

    if (errors.slug) {
      if (!sanitized) {
        setErrors((prev) => ({ ...prev, slug: 'Project slug is required' }));
      } else if (!validateSlug(sanitized)) {
        setErrors((prev) => ({
          ...prev,
          slug: 'Slug must contain only lowercase letters, numbers, and single hyphens',
        }));
      } else {
        setErrors((prev) => ({ ...prev, slug: undefined }));
      }
    }
  };

  const handleAddTag = (tagToAdd?: string) => {
    const raw = tagToAdd || tagInput;
    const sanitized = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 20);

    if (!sanitized) return;
    if (formData.tags.includes(sanitized) || formData.tags.length >= 6) return;

    onChange((prev) => ({ ...prev, tags: [...prev.tags, sanitized] }));
    if (!tagToAdd) {
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  };

  return (
    <div className="space-y-5 pt-2">
      {/* Project Name */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="project-name" className="text-xs font-semibold text-foreground">
            Project Name <span className="text-status-danger">*</span>
          </Label>
          <span className="text-[11px] text-muted-foreground">Human-friendly title</span>
        </div>
        <Input
          id="project-name"
          type="text"
          placeholder="e.g. Acme API Gateway"
          value={formData.name}
          onChange={handleNameChange}
          disabled={isSubmitting}
          error={!!errors.name}
          autoFocus={!isEditMode}
          className="h-9.5 text-sm"
        />
        <FieldError error={errors.name} />
      </div>

      {/* Project Slug */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="project-slug" className="text-xs font-semibold text-foreground">
            Project Slug / Identifier <span className="text-status-danger">*</span>
          </Label>
          <span className="text-[11px] text-muted-foreground font-mono">lowercase & hyphens</span>
        </div>
        <Input
          id="project-slug"
          type="text"
          placeholder="acme-api-gateway"
          value={formData.slug}
          onChange={handleSlugChange}
          disabled={isSubmitting}
          error={!!errors.slug}
          className="h-9.5 text-sm font-mono"
        />
        <FieldError error={errors.slug} />
        {!errors.slug && (
          <div className="rounded-md border border-border bg-muted/20 px-3 py-1.5 flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span className="truncate flex items-center gap-1.5">
              <Globe className="size-3 shrink-0 text-muted-foreground/80" />
              <span>/projects/</span>
              <span className="text-foreground font-semibold">
                {formData.slug || 'project-slug'}
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground/60 shrink-0 uppercase tracking-wider">
              route preview
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
            const isSelected = formData.environment === env.id;
            return (
              <button
                key={env.id}
                type="button"
                onClick={() =>
                  onChange((prev) => ({ ...prev, environment: env.id }))
                }
                disabled={isSubmitting}
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
          <Label htmlFor="project-description" className="text-xs font-semibold text-foreground">
            Description
          </Label>
          <span className="text-[11px] text-muted-foreground">Optional summary</span>
        </div>
        <Textarea
          id="project-description"
          placeholder="Core storefront, checkout API gateway, and PostgreSQL cluster..."
          value={formData.description}
          onChange={(e) => {
            onChange((prev) => ({ ...prev, description: e.target.value }));
            if (errors.description) {
              setErrors((prev) => ({ ...prev, description: undefined }));
            }
          }}
          disabled={isSubmitting}
          error={!!errors.description}
          rows={3}
          className="resize-none text-xs sm:text-sm"
        />
        <FieldError error={errors.description} />
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
              disabled={isSubmitting || formData.tags.length >= 6}
              className="pl-8 h-8 text-xs font-mono"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleAddTag()}
            disabled={!tagInput.trim() || isSubmitting || formData.tags.length >= 6}
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
            const isAdded = formData.tags.includes(suggested);
            return (
              <button
                key={suggested}
                type="button"
                onClick={() => handleAddTag(suggested)}
                disabled={isAdded || isSubmitting || formData.tags.length >= 6}
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
        {formData.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {formData.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="gap-1 pl-2 pr-1 py-0.5 text-xs font-mono rounded-md"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  disabled={isSubmitting}
                  className="rounded-full p-0.5 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
