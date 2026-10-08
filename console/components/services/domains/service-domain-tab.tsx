'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { DomainList } from './domain-list';
import { AddDomainDialog, AddDomainInput } from './add-domain-dialog';
import { Service, ServiceDomain } from '@/lib/types';
import {
  addServiceDomain,
  deleteServiceDomain,
  setPrimaryServiceDomain,
} from '@/lib/api/services';
import { toast } from 'sonner';

export interface ServiceDomainTabProps {
  service: Service;
  nodeIp?: string;
  onDomainsUpdated?: () => void;
}

export function ServiceDomainTab({ service, nodeIp, onDomainsUpdated }: ServiceDomainTabProps) {
  const [domains, setDomains] = useState<ServiceDomain[]>(service.domains || []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    if (service.domains) {
      setDomains(service.domains);
    }
  }, [service.domains]);

  const handleAddDomain = async (data: AddDomainInput) => {
    try {
      setIsMutating(true);
      const created = await addServiceDomain(service.id, {
        domain: data.domain,
        port: data.port,
        path: data.path,
        internalPath: data.internalPath,
        ssl: data.ssl,
        primary: domains.length === 0,
      });

      const updatedList = domains.length === 0
        ? [created]
        : [...domains, created];

      setDomains(updatedList);
      toast.success(`Domain ${data.domain} attached successfully`);
      onDomainsUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add domain';
      toast.error(msg);
    } finally {
      setIsMutating(false);
    }
  };

  const handleRemoveDomain = async (id: string) => {
    try {
      setIsMutating(true);
      await deleteServiceDomain(service.id, id);
      setDomains((prev) => prev.filter((d) => d.id !== id));
      toast.success('Domain removed successfully');
      onDomainsUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove domain';
      toast.error(msg);
    } finally {
      setIsMutating(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      setIsMutating(true);
      await setPrimaryServiceDomain(service.id, id);
      setDomains((prev) =>
        prev.map((d) => ({
          ...d,
          primary: d.id === id,
        }))
      );
      toast.success('Primary domain updated');
      onDomainsUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to set primary domain';
      toast.error(msg);
    } finally {
      setIsMutating(false);
    }
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
