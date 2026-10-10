'use client';

import React, { useState, useEffect } from 'react';
import { useUpdateProject } from '@/lib/queries';
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

export interface EditProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (updatedProject: Project) => void;
}

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: EditProjectDialogProps) {
  const [formData, setFormData] = useState<ProjectFormData>({
    name: project.name,
    slug: project.slug,
    description: project.description || '',
    environment: project.environment || 'production',
  });
  const [errors, setErrors] = useState<ProjectFormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (open && project) {
      setFormData({
        name: project.name,
        slug: project.slug,
        description: project.description || '',
        environment: project.environment || 'production',
      });
      setErrors({});
      setGeneralError(null);
    }
  }, [open, project]);

  const updateMutation = useUpdateProject({
    onSuccess: (updated) => {
      onOpenChange(false);
      onSuccess?.(updated);
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
        setGeneralError(parsed.message || 'Failed to update project');
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

    updateMutation.mutate({
      id: project.id,
      input: {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim() || undefined,
        environment: formData.environment,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground font-sans">
            Edit Project
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Update your project workspace and environment settings.
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
            isSubmitting={updateMutation.isPending}
            isEditMode={true}
          />

          <DialogFooter className="pt-2 border-t border-border flex items-center justify-between sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
              className="text-sm h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={updateMutation.isPending}
              className="text-sm h-9 gap-1.5 cursor-pointer active:not-aria-[haspopup]:translate-y-px"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
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
