'use client';

import React, { useState } from 'react';
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
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmDestructiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Value user must type to confirm (e.g. project name or service name). If omitted, confirmation input is not required. */
  confirmMatch?: string;
  inputLabel?: string;
  confirmButtonText?: string;
  confirmText?: string;
  isPending?: boolean;
  onConfirm: () => void | Promise<void>;
  /** Optional warning callout rendered above input */
  warningCallout?: React.ReactNode;
  contentClassName?: string;
}

export function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmMatch,
  inputLabel,
  confirmButtonText,
  confirmText,
  isPending = false,
  onConfirm,
  warningCallout,
  contentClassName,
}: ConfirmDestructiveDialogProps) {
  const effectiveButtonText = confirmButtonText || confirmText || 'Confirm Delete';
  const [inputValue, setInputValue] = useState('');

  const isConfirmed = confirmMatch
    ? inputValue.trim() === confirmMatch.trim()
    : true;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isPending) {
      setInputValue('');
      onOpenChange(nextOpen);
    }
  };

  const handleConfirm = async () => {
    if (!isConfirmed || isPending) return;
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn("sm:max-w-lg border-status-danger/40", contentClassName)}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-status-danger/10 border border-status-danger/20 flex items-center justify-center text-status-danger shrink-0">
              <AlertTriangle className="size-4" />
            </div>
            <DialogTitle className="text-base font-semibold text-status-danger">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {warningCallout && (
          <div className="my-1">
            {warningCallout}
          </div>
        )}

        {confirmMatch !== undefined && (
          <div className="space-y-2 py-2">
            <Label className="text-xs font-medium text-foreground">
              {inputLabel || (
                <>
                  Type <span className="font-mono font-semibold text-foreground select-all">{confirmMatch}</span> to confirm:
                </>
              )}
            </Label>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmMatch}
              className="h-9 font-mono text-xs"
              disabled={isPending}
              autoFocus
            />
          </div>
        )}

        <DialogFooter className="gap-2.5 sm:gap-3 pt-3 flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
            className="h-9 text-sm"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={!isConfirmed || isPending}
            className="h-9 text-sm gap-1.5"
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            <span>{effectiveButtonText}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
