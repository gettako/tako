'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createProject } from '@/lib/api/projects';
import { Project } from '@/lib/types';
import { toast } from 'sonner';
import {
  ProjectFormFields,
  ProjectFormData,
  ProjectFormErrors,
  validateSlug,
} from './project-form-fields';

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
  tags: [],
};

export function CreateProjectDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateProjectDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<ProjectFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<ProjectFormErrors>({});

  useEffect(() => {
    if (!open) {
      setFormData(INITIAL_FORM_DATA);
      setErrors({});
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully', {
        description: `Project "${newProject.name}" is ready for services deployment.`,
      });
      onOpenChange(false);
      onSuccess?.(newProject);
      router.push(`/projects/${newProject.id}`);
    },
    onError: (err: Error) => {
      toast.error('Failed to create project', {
        description: err.message || 'Please check input parameters and try again.',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
      tags: formData.tags.length > 0 ? formData.tags : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground font-sans">
            Create New Project
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Initialize an isolated workload workspace for services, databases, and environments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
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
              className="text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createMutation.isPending}
              className="text-xs h-9 gap-1.5 cursor-pointer active:not-aria-[haspopup]:translate-y-px"
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
