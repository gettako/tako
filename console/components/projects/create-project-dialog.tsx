'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateProject } from '@/lib/queries';
import { Project } from '@/lib/types';
import {
  ProjectFormFields,
  ProjectFormData,
  ProjectFormErrors,
  validateSlug,
} from './project-form-fields';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { parseApiError } from '@/lib/form-errors';

export interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (project: Project) => void;
}

const INITIAL_FORM_DATA: ProjectFormData = {
  name: '',
  slug: '',
  description: '',
  environment: 'production',
};

export function CreateProjectDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateProjectDialogProps) {
  const router = useRouter();

  const [formData, setFormData] = useState<ProjectFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFormData(INITIAL_FORM_DATA);
      setErrors({});
      setGeneralError(null);
    }
  }, [open]);

  const createMutation = useCreateProject({
    onSuccess: (newProject) => {
      onOpenChange(false);
      onSuccess?.(newProject);
      router.push(`/projects/${newProject.slug || newProject.id}`);
    },
    onError: (err) => {
      const parsed = parseApiError(err);
      if (parsed.is422) {
        if (Object.keys(parsed.fieldErrors).length > 0) {
          setErrors(parsed.fieldErrors);
          if (parsed.message && !Object.values(parsed.fieldErrors).includes(parsed.message)) {
            setGeneralError(parsed.message);
          }
        } else {
          setGeneralError(parsed.message || 'Validation failed');
        }
      } else {
        setGeneralError(parsed.message || 'Failed to create project');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    let hasError = false;
    const newErrors: ProjectFormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
      hasError = true;
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Project slug is required';
      hasError = true;
    } else if (!validateSlug(formData.slug)) {
      newErrors.slug = 'Slug must contain only lowercase letters, numbers, and single hyphens';
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    createMutation.mutate({
      name: formData.name.trim(),
      slug: formData.slug.trim(),
      description: formData.description.trim() || undefined,
      environment: formData.environment,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground font-sans">
            Create Project
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Create a new workspace for your services and deployments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {generalError && (
            <div role="alert" className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-md">
              {generalError}
            </div>
          )}

          <ProjectFormFields
            formData={formData}
            onChange={setFormData}
            errors={errors}
            setErrors={setErrors}
            isSubmitting={createMutation.isPending}
            isEditMode={false}
          />

          <DialogFooter className="pt-2 border-t border-border flex items-center justify-between sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className="text-sm h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createMutation.isPending}
              className="text-sm h-9 gap-1.5 cursor-pointer active:not-aria-[haspopup]:translate-y-px"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Creating Workspace...</span>
                </>
              ) : (
                <span>Create Project</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
