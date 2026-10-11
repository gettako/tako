'use client';

import React, { useState, useEffect } from 'react';
import { Node } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError } from '@/components/ui/field';
import { parseApiError } from '@/lib/form-errors';
import { useUpdateNode } from '@/lib/queries';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface EditNodeDialogProps {
  node: Node | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditNodeDialog({
  node,
  open,
  onOpenChange,
  onSuccess,
}: EditNodeDialogProps) {
  const [name, setName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [publicIp, setPublicIp] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');

  useEffect(() => {
    if (node && open) {
      setName(node.name || '');
      setIpAddress(node.ipAddress || '');
      setPublicIp(node.publicIp || '');
      setFieldErrors({});
      setGeneralError('');
    }
  }, [node, open]);

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (generalError) setGeneralError('');
  };

  const updateMutation = useUpdateNode({
    onSuccess: () => {
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err) => {
      const parsed = parseApiError(err);
      if (parsed.is422) {
        setFieldErrors(parsed.fieldErrors);
        setGeneralError(parsed.message || 'Validation failed');
      } else {
        toast.error(parsed.message || 'Failed to update node specifications');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!node) return;

    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = 'Node hostname/name is required';
    }
    if (!ipAddress.trim()) {
      errors.ipAddress = 'Internal/Private IP address is required';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    updateMutation.mutate({
      id: node.id,
      input: {
        name: name.trim(),
        ipAddress: ipAddress.trim(),
        publicIp: publicIp.trim() || undefined,
      },
    });
  };

  if (!node) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Pencil className="size-4" />
            </div>
            <div>
              <DialogTitle>Edit Node Specifications</DialogTitle>
              <DialogDescription>
                Update cluster networking addresses and display name for this node.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {generalError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
              {generalError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Node Hostname / Name</label>
            <Input
              id="edit-node-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearFieldError('name');
              }}
              placeholder="e.g. tako-worker-01"
              error={!!fieldErrors.name}
              className="h-8 text-xs font-sans"
            />
            <FieldError error={fieldErrors.name} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Private IP (Internal LAN)</label>
              <span className="text-[10px] text-muted-foreground">e.g. eth0 interface</span>
            </div>
            <Input
              id="edit-node-ip"
              value={ipAddress}
              onChange={(e) => {
                setIpAddress(e.target.value);
                clearFieldError('ipAddress');
              }}
              placeholder="e.g. 10.3.19.31 or 192.168.1.10"
              error={!!fieldErrors.ipAddress}
              className="h-8 text-xs font-mono"
            />
            <FieldError error={fieldErrors.ipAddress} />
            <p className="text-[11px] text-muted-foreground">
              Internal cluster interface IP (from <code>ip -br addr show</code>).
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Public IP (External)</label>
              <span className="text-[10px] text-muted-foreground">WAN / Internet</span>
            </div>
            <Input
              id="edit-node-public-ip"
              value={publicIp}
              onChange={(e) => {
                setPublicIp(e.target.value);
                clearFieldError('publicIp');
              }}
              placeholder="e.g. 54.12.34.56"
              error={!!fieldErrors.publicIp}
              className="h-8 text-xs font-mono"
            />
            <FieldError error={fieldErrors.publicIp} />
            <p className="text-[11px] text-muted-foreground">
              Public IPv4 used by Traefik edge routing and domain DNS records.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              id="edit-node-submit"
              disabled={updateMutation.isPending}
              className="gap-1.5"
            >
              {updateMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
              <span>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
