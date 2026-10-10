'use client';

import React from 'react';
import { useServices, useDeleteProject } from '@/lib/queries';
import { ConfirmDestructiveDialog } from '@/components/ui/confirm-destructive-dialog';
import { Layers, AlertTriangle } from 'lucide-react';

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
    enabled: open,
  });

  const deleteMutation = useDeleteProject({
    onSuccess: () => {
      onOpenChange(false);
      onSuccess?.();
    },
  });

  const effectiveServicesCount =
    fetchedServices?.length !== undefined
      ? fetchedServices.length
      : (servicesCount ?? 0);
  const hasServices = effectiveServicesCount > 0;

  return (
    <ConfirmDestructiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete Project: ${project.name}`}
      description={
        hasServices
          ? `This project contains ${effectiveServicesCount} active service(s). Deleting this project will permanently terminate all child containers, workloads, and associated configurations.`
          : 'This action is irreversible. All configurations, environments, and associations will be permanently destroyed.'
      }
      confirmMatch={project.name}
      confirmButtonText={hasServices ? 'Delete Project & All Services' : 'Delete Project'}
      isPending={deleteMutation.isPending}
      onConfirm={() => {
        deleteMutation.mutate({
          id: project.id,
          name: project.name,
          slug: project.slug,
          cascade: true,
        });
      }}
      warningCallout={
        hasServices ? (
          <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-status-danger">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{effectiveServicesCount} active service(s) will be permanently terminated</span>
            </div>
            {fetchedServices && fetchedServices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5 max-h-28 overflow-y-auto">
                {fetchedServices.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/80 border border-border text-[11px] font-mono text-foreground"
                  >
                    <Layers className="size-3 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[140px]">{s.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : undefined
      }
    />
  );
}
