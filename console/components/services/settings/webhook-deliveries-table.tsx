'use client';

import React, { useState } from 'react';
import { WebhookDelivery } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WebhookPayloadDialog } from './webhook-payload-dialog';
import { FileJson, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface WebhookDeliveriesTableProps {
  deliveries: WebhookDelivery[];
}

export function WebhookDeliveriesTable({ deliveries }: WebhookDeliveriesTableProps) {
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null);

  if (deliveries.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-border/60 rounded-lg">
        <Clock className="size-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No webhook deliveries recorded yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Push to your repository branch or use the &quot;Send Test Ping&quot; button to test triggers.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border/70 overflow-hidden bg-card shadow-2xs">
        <Table>
          <TableHeader className="bg-muted/40 border-b border-border/60">
            <TableRow className="h-11 hover:bg-transparent">
              <TableHead className="w-[30%]">Timestamp</TableHead>
              <TableHead className="w-[20%]">Event</TableHead>
              <TableHead className="w-[20%]">Status</TableHead>
              <TableHead className="w-[15%]">Duration</TableHead>
              <TableHead className="text-right w-[15%]">Payload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/40">
            {deliveries.map((delivery) => {
              const isSuccess = delivery.status === 'success';
              return (
                <TableRow key={delivery.id} className="h-14 hover:bg-muted/30 transition-colors">
                  {/* Timestamp */}
                  <TableCell className="font-mono text-xs text-foreground">
                    {new Date(delivery.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </TableCell>

                  {/* Event Tag */}
                  <TableCell>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/40">
                      {delivery.event}
                    </span>
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {isSuccess ? (
                        <CheckCircle2 className="size-4 text-status-success shrink-0" />
                      ) : (
                        <XCircle className="size-4 text-status-danger shrink-0" />
                      )}
                      <Badge
                        variant="outline"
                        className={
                          isSuccess
                            ? 'bg-status-success/10 text-status-success border-status-success/30 font-mono text-xs'
                            : 'bg-status-danger/10 text-status-danger border-status-danger/30 font-mono text-xs'
                        }
                      >
                        {delivery.statusCode} {isSuccess ? 'OK' : 'Error'}
                      </Badge>
                    </div>
                  </TableCell>

                  {/* Duration */}
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {delivery.durationMs}ms
                  </TableCell>

                  {/* Payload Action */}
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDelivery(delivery)}
                      className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-primary active:not-aria-[haspopup]:translate-y-px"
                    >
                      <FileJson className="size-3.5" />
                      <span>Inspect</span>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <WebhookPayloadDialog
        open={!!selectedDelivery}
        onOpenChange={(open) => {
          if (!open) setSelectedDelivery(null);
        }}
        delivery={selectedDelivery}
      />
    </>
  );
}
