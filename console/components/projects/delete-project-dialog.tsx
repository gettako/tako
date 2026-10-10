'use client';

import React from 'react';
import { useServices, useDeleteProject } from '@/lib/queries';
import { ConfirmDestructiveDialog } from '@/components/ui/confirm-destructive-dialog';
import { Layers } from 'lucide-react';

export interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: {
    id: string;
    name: string;
    slug?: string;
  };
  servicesCount?: number;
  onSuccess?: () => void;
}

export function DeleteProjectDialog({
  open,
  onOpenChange,
  project,
  servicesCount,
  onSuccess,
}: DeleteProjectDialogProps) {
  const { data: fetchedServices } = useServices(project.id, {
    enabled: open && servicesCount === undefined,
  });

  const deleteMutation = useDeleteProject({
    onSuccess: () => {
      onOpenChange(false);
      onSuccess?.();
    },
  });

  const effectiveServicesCount =
    servicesCount !== undefined ? servicesCount : (fetchedServices?.length ?? 0);
  const hasServices = effectiveServicesCount > 0;

  return (
    <ConfirmDestructiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete Project: ${project.name}`}
      description={
        hasServices
          ? `Cannot delete project while it contains active services. Delete or reassign all ${effectiveServicesCount} service(s) first.`
          : 'This action is irreversible. All configurations, environments, and associations will be permanently destroyed.'
      }
      confirmMatch={hasServices ? undefined : project.name}
      isPending={deleteMutation.isPending}
      onConfirm={() => {
        if (!hasServices) {
          deleteMutation.mutate({ id: project.id, name: project.name, slug: project.slug });
        }
      }}
      warningCallout={
        hasServices ? (
          <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-xs flex items-center gap-2 text-foreground">
            <Layers className="size-4 text-status-warning shrink-0" />
            <span>Project has {effectiveServicesCount} active service(s) attached.</span>
          </div>
        ) : undefined
      }
    />
  );
}
