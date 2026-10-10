'use client';

import React, { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export interface ProjectFormData {
  name: string;
  slug: string;
  description: string;
  environment: 'production' | 'staging' | 'development';
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
  indicatorColor: string;
}> = [
  {
    id: 'production',
    label: 'Production',
    indicatorColor: 'bg-status-success',
  },
  {
    id: 'staging',
    label: 'Staging',
    indicatorColor: 'bg-status-warning',
  },
  {
    id: 'development',
    label: 'Development',
    indicatorColor: 'bg-status-info',
  },
];

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

  return (
    <div className="space-y-4">
      {/* Project Name */}
      <div className="space-y-1.5">
        <Label htmlFor="project-name" className="text-xs font-medium text-foreground">
          Project Name <span className="text-status-danger">*</span>
        </Label>
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
        <Label htmlFor="project-slug" className="text-xs font-medium text-foreground">
          Project Slug <span className="text-status-danger">*</span>
        </Label>
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
          <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5 pt-0.5">
            <Globe className="size-3 shrink-0 text-muted-foreground/70" />
            <span>/projects/{formData.slug || 'project-slug'}</span>
          </p>
        )}
      </div>

      {/* Environment Tier */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-foreground">
          Environment
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                  'flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all cursor-pointer active:not-aria-[haspopup]:translate-y-px outline-none',
                  isSelected
                    ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/40 font-medium'
                    : 'border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('size-2 rounded-full shrink-0', env.indicatorColor)} />
                  <span className="text-xs font-medium truncate">{env.label}</span>
                </div>
                {isSelected && <Check className="size-3 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="project-description" className="text-xs font-medium text-foreground">
          Description <span className="text-muted-foreground font-normal text-[11px]">(optional)</span>
        </Label>
        <Textarea
          id="project-description"
          placeholder="Brief description of this project workspace..."
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
    </div>
  );
}
