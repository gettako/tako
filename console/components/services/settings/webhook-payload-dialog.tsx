'use client';

import React, { useState } from 'react';
import { WebhookDelivery } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, Webhook } from 'lucide-react';
import { toast } from 'sonner';

interface WebhookPayloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delivery: WebhookDelivery | null;
}

export function WebhookPayloadDialog({
  open,
  onOpenChange,
  delivery,
}: WebhookPayloadDialogProps) {
  const [copiedSection, setCopiedSection] = useState<'request' | 'response' | null>(null);

  if (!delivery) return null;

  const handleCopy = (section: 'request' | 'response', text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast.success(`${section === 'request' ? 'Request payload' : 'Response body'} copied`);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const isSuccess = delivery.status === 'success';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between pr-4">
            <DialogTitle className="text-lg font-semibold">
              Webhook Delivery Details
            </DialogTitle>
            <Badge
              variant="outline"
              className={isSuccess ? 'bg-status-success/10 text-status-success border-status-success/30 font-mono text-xs' : 'bg-status-danger/10 text-status-danger border-status-danger/30 font-mono text-xs'}
            >
              {delivery.statusCode} {isSuccess ? 'OK' : 'Error'}
            </Badge>
          </div>
          <DialogDescription className="text-sm text-muted-foreground font-mono mt-1">
            Event: {delivery.event} • Time: {new Date(delivery.timestamp).toISOString()} • Duration:{' '}
            {delivery.durationMs}ms
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1 text-sm">
          {/* Request Payload */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Request Payload (JSON)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy('request', delivery.requestPayload)}
                className="h-7 text-sm gap-1.5 text-muted-foreground hover:text-foreground"
              >
                {copiedSection === 'request' ? (
                  <Check className="size-3.5 text-status-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                Copy Payload
              </Button>
            </div>
            <pre className="p-3.5 rounded-lg bg-[#0B0C14] text-[#939DB8] font-mono text-sm overflow-x-auto border border-border leading-relaxed max-h-60">
              {delivery.requestPayload}
            </pre>
          </div>

          {/* Response Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Webhook Response Body
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy('response', delivery.responseBody)}
                className="h-7 text-sm gap-1.5 text-muted-foreground hover:text-foreground"
              >
                {copiedSection === 'response' ? (
                  <Check className="size-3.5 text-status-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                Copy Response
              </Button>
            </div>
            <pre className="p-3.5 rounded-lg bg-[#0B0C14] text-[#939DB8] font-mono text-sm overflow-x-auto border border-border leading-relaxed max-h-40">
              {delivery.responseBody}
            </pre>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-sm h-9 active:not-aria-[haspopup]:translate-y-px"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
