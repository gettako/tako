'use client';

import React, { useState } from 'react';
import { Plus, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { DomainList } from './domain-list';
import { AddDomainDialog, AddDomainInput } from './add-domain-dialog';
import { Service, ServiceDomain } from '@/lib/types';

export interface ServiceDomainTabProps {
  service: Service;
}

export function ServiceDomainTab({ service }: ServiceDomainTabProps) {
  const [domains, setDomains] = useState<ServiceDomain[]>(service.domains || []);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddDomain = (data: AddDomainInput) => {
    const newDomain: ServiceDomain = {
      id: `dom-${Date.now()}`,
      domain: data.domain,
      port: data.port,
      path: data.path,
      ssl: data.ssl,
      primary: domains.length === 0,
      createdAt: new Date().toISOString(),
    };
    setDomains([...domains, newDomain]);
  };

  const handleRemoveDomain = (id: string) => {
    setDomains(domains.filter((d) => d.id !== id));
  };

  const handleSetPrimary = (id: string) => {
    setDomains(
      domains.map((d) => ({
        ...d,
        primary: d.id === id,
      }))
    );
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Globe}
        title="Custom Domains & Routing"
        description="Configure custom domain hostnames and automatic SSL certificates"
        action={
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="gap-1.5 text-xs h-9"
          >
            <Plus className="size-3.5" />
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
          onRemoveDomain={handleRemoveDomain}
          onSetPrimary={handleSetPrimary}
        />
      )}

      <AddDomainDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAddDomain={handleAddDomain}
      />
    </div>
  );
}
