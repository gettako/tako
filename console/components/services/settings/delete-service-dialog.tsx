'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Service } from '@/lib/types';
import { deleteService } from '@/lib/api/services';
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
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();
  const [confirmationName, setConfirmationName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = confirmationName.trim() === service.name.trim();

  const handleDelete = async () => {
    if (!isConfirmed) return;

    try {
      setIsDeleting(true);
      await deleteService(service.id);

      // Instantly remove service from React Query caches
      queryClient.setQueriesData<Service[]>({ queryKey: ['services'] }, (old) =>
        old ? old.filter((s) => s.id !== service.id && s.slug !== service.slug) : []
      );
      queryClient.removeQueries({ queryKey: ['service', service.id] });

      // Invalidate queries so fresh data is loaded
      await queryClient.invalidateQueries({ queryKey: ['services'] });
      await queryClient.invalidateQueries({ queryKey: ['project-services', service.projectId] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });

      toast.success(`Service "${service.name}" was permanently deleted`);
      onOpenChange(false);
      router.push(`/projects/${service.projectId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete service');
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!isDeleting) {
          setConfirmationName('');
          onOpenChange(val);
        }
      }}
    >
      <DialogContent className="sm:max-w-md border-status-danger/40">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-status-danger">
            Delete Service: {service.name}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            This action <span className="text-status-danger font-semibold">cannot be undone</span>.
            All running containers, environment variables, domain certificates, build logs, and
            local volumes associated with this service will be permanently purged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4 text-sm">
          <Label htmlFor="confirmation-input" className="text-foreground font-normal leading-relaxed">
            Please type <span className="font-mono font-semibold text-status-danger">{service.name}</span> to confirm:
          </Label>
          <Input
            id="confirmation-input"
            value={confirmationName}
            onChange={(e) => setConfirmationName(e.target.value)}
            placeholder={service.name}
            disabled={isDeleting}
            className="font-mono text-sm border-status-danger/40 focus-visible:border-status-danger"
            autoFocus
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2.5 pt-2">
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
                Deleting Service...
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" />
                Permanently Delete Service
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
