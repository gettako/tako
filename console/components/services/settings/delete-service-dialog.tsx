'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Service } from '@/lib/types';
import { useDeleteService } from '@/lib/queries';
import { ConfirmDestructiveDialog } from '@/components/ui/confirm-destructive-dialog';

interface DeleteServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service;
}

export function DeleteServiceDialog({
  open,
  onOpenChange,
  service,
}: DeleteServiceDialogProps) {
  const router = useRouter();

  const deleteMutation = useDeleteService({
    onSuccess: () => {
      onOpenChange(false);
      router.push(`/projects/${service.projectId}`);
    },
  });

  return (
    <ConfirmDestructiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete Service: ${service.name}`}
      description="This action cannot be undone. All active containers, build artifacts, routing rules, and metrics associated with this service will be permanently deleted."
      confirmMatch={service.name}
      isPending={deleteMutation.isPending}
      onConfirm={() => {
        deleteMutation.mutate({
          id: service.id,
          projectId: service.projectId,
          name: service.name,
          slug: service.slug,
        });
      }}
    />
  );
}
