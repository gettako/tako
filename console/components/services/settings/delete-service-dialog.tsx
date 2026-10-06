'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const [confirmationName, setConfirmationName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = confirmationName.trim() === service.name.trim();

  const handleDelete = async () => {
    if (!isConfirmed) return;

    try {
      setIsDeleting(true);
      await deleteService(service.id);
      toast.success(`Service "${service.name}" was permanently deleted`);
      onOpenChange(false);
      router.push(`/projects/${service.projectId}`);
    } catch {
      toast.error('Failed to delete service');
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
      <DialogContent className="max-w-md border-status-danger/40">
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

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="text-sm"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="text-sm bg-status-danger hover:bg-status-danger/90 text-white font-medium gap-1.5"
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
