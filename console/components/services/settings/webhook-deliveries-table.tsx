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
      <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/40 border-b border-border/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timestamp</TableHead>
              <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event</TableHead>
              <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</TableHead>
              <TableHead className="py-2.5 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/40">
            {deliveries.map((delivery) => {
              const isSuccess = delivery.status === 'success';
              return (
                <TableRow key={delivery.id} className="hover:bg-muted/30 transition-colors">
                  {/* Timestamp */}
                  <TableCell className="py-3 px-4 font-mono text-sm text-foreground">
                    {new Date(delivery.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </TableCell>

                  {/* Event Tag */}
                  <TableCell className="py-3 px-4">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-foreground border border-border/40">
                      {delivery.event}
                    </span>
                  </TableCell>

                  {/* Status Badge */}
                  <TableCell className="py-3 px-4">
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
                  <TableCell className="py-3 px-4 font-mono text-sm text-muted-foreground">
                    {delivery.durationMs}ms
                  </TableCell>

                  {/* Payload Action */}
                  <TableCell className="py-3 px-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDelivery(delivery)}
                      className="h-8 text-sm gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <FileJson className="size-3.5" />
                      Inspect
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
