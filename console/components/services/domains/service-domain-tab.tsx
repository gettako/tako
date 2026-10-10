'use client';

import React, { useState } from 'react';
import { Plus, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { DomainList } from './domain-list';
import { AddDomainDialog, AddDomainInput } from './add-domain-dialog';
import { Service } from '@/lib/types';
import {
  useServiceDomains,
  useAddServiceDomain,
  useDeleteServiceDomain,
  useSetPrimaryServiceDomain,
} from '@/lib/queries';

export interface ServiceDomainTabProps {
  service: Service;
  nodeIp?: string;
  onDomainsUpdated?: () => void;
}

export function ServiceDomainTab({ service, nodeIp, onDomainsUpdated }: ServiceDomainTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: domains = service.domains || [] } = useServiceDomains(service.id);
  const addMutation = useAddServiceDomain(service.id, { onSuccess: onDomainsUpdated });
  const deleteMutation = useDeleteServiceDomain(service.id, { onSuccess: onDomainsUpdated });
  const setPrimaryMutation = useSetPrimaryServiceDomain(service.id, { onSuccess: onDomainsUpdated });

  const isMutating = addMutation.isPending || deleteMutation.isPending || setPrimaryMutation.isPending;

  const handleAddDomain = async (data: AddDomainInput) => {
    addMutation.mutate({
      domain: data.domain,
      port: data.port,
      path: data.path,
      internalPath: data.internalPath,
      ssl: data.ssl,
      primary: domains.length === 0,
    });
  };

  const handleRemoveDomain = async (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleSetPrimary = async (id: string) => {
    setPrimaryMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Globe}
        title="Custom Domains & Ingress Routing"
        description="Configure edge domain hostnames, automatic Let's Encrypt SSL certificates, and path routing"
        action={
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            disabled={isMutating}
            className="gap-1.5 text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isMutating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            <span>Add Domain</span>
          </Button>
        }
      />

      {domains.length === 0 ? (
        <EmptyState
          title="No custom domains connected"
          description="Route your custom domain to this container with automatic SSL certificate issuance."
          icon={Globe}
          action={{
            label: 'Add Domain',
            icon: Plus,
            onClick: () => setDialogOpen(true),
          }}
        />
      ) : (
        <DomainList
          domains={domains}
          nodeIp={nodeIp || service.nodeName || '127.0.0.1'}
          onRemoveDomain={handleRemoveDomain}
          onSetPrimary={handleSetPrimary}
        />
      )}

      <AddDomainDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAddDomain={handleAddDomain}
        defaultPort={service.ports?.[0] || 80}
      />
    </div>
  );
}
