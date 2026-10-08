'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteProject } from '@/lib/api/projects';
import { getServices } from '@/lib/api/services';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Trash2, Loader2, AlertTriangle, Layers, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();
  const [confirmationName, setConfirmationName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: fetchedServices, isLoading: checkingServices } = useQuery({
    queryKey: ['services', project.id],
    queryFn: () => getServices(project.id),
    enabled: open && servicesCount === undefined,
  });

  const effectiveServicesCount =
    servicesCount !== undefined ? servicesCount : (fetchedServices?.length ?? 0);
  const hasServices = effectiveServicesCount > 0;
  const isConfirmed = confirmationName.trim() === project.name.trim();

  const handleDelete = async () => {
    if (hasServices || !isConfirmed || isDeleting) return;

    try {
      setIsDeleting(true);
      await deleteProject(project.id);

      // Invalidate queries so projects list updates immediately
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.removeQueries({ queryKey: ['project', project.id] });
      if (project.slug) {
        queryClient.removeQueries({ queryKey: ['project', project.slug] });
      }

      toast.success(`Project "${project.name}" was permanently deleted`);
      setConfirmationName('');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete project');
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (val: boolean) => {
    if (!isDeleting) {
      setConfirmationName('');
      onOpenChange(val);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`sm:max-w-md ${hasServices ? 'border-status-warning/40' : 'border-status-danger/40'}`}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {hasServices ? (
              <div className="size-8 rounded-lg bg-status-warning/10 border border-status-warning/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-4 text-status-warning" />
              </div>
            ) : (
              <div className="size-8 rounded-lg bg-status-danger/10 border border-status-danger/20 flex items-center justify-center shrink-0">
                <Trash2 className="size-4 text-status-danger" />
              </div>
            )}
            <DialogTitle className={`text-lg font-semibold ${hasServices ? 'text-foreground' : 'text-status-danger'}`}>
              {hasServices ? 'Cannot Delete Project' : `Delete Project: ${project.name}`}
            </DialogTitle>
          </div>

          <DialogDescription className="text-sm text-muted-foreground pt-1.5 leading-relaxed">
            {hasServices ? (
              <span>
                This project contains active workloads. Projects can only be deleted when they have no running services or databases.
              </span>
            ) : (
              <span>
                This action <span className="text-status-danger font-semibold">cannot be undone</span>.
                All project configuration, metadata, and environment settings will be permanently removed.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {hasServices ? (
          <div className="space-y-3 py-3">
            <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-status-warning uppercase tracking-wider font-mono">
                <Layers className="size-3.5" />
                <span>
                  {effectiveServicesCount} {effectiveServicesCount === 1 ? 'Service' : 'Services'} Remaining
                </span>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed">
                To prevent accidental data loss and dangling cluster resources, please delete all services inside <span className="font-semibold text-foreground">{project.name}</span> first before attempting to delete this project.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 py-3 text-sm">
            <Label htmlFor="project-confirmation-input" className="text-foreground font-normal leading-relaxed">
              Please type <span className="font-mono font-semibold text-status-danger">{project.name}</span> to confirm:
            </Label>
            <Input
              id="project-confirmation-input"
              value={confirmationName}
              onChange={(e) => setConfirmationName(e.target.value)}
              placeholder={project.name}
              disabled={isDeleting}
              className="font-mono text-sm border-status-danger/40 focus-visible:border-status-danger"
              autoFocus
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2.5 pt-2">
          {hasServices ? (
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => onOpenChange(false)}
              className="text-sm h-9 w-full sm:w-auto"
            >
              Understood
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => onOpenChange(false)}
                disabled={isDeleting}
                className="text-sm h-9 active:not-aria-[haspopup]:translate-y-px"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="default"
                onClick={handleDelete}
                disabled={!isConfirmed || isDeleting}
                className="text-sm h-9 bg-status-danger hover:bg-status-danger/90 text-white font-medium gap-1.5 active:not-aria-[haspopup]:translate-y-px"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Deleting Project...
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5" />
                    Permanently Delete Project
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
