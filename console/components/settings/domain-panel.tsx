'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDomainSettings, updateDomainSettings } from '@/lib/api/settings';
import { getNodes } from '@/lib/api/nodes';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Globe, ShieldCheck, Save, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';

export function DomainPanel() {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['domain-settings'],
    queryFn: getDomainSettings,
  });

  const { data: nodes = [] } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
  });

  const leaderNode = nodes.find((n) => n.role === 'leader') || nodes[0];
  const leaderIp = settings?.customDnsIp || leaderNode?.publicIp || leaderNode?.ipAddress || '127.0.0.1';

  const [domain, setDomain] = useState(settings?.domain ?? 'console.gettako.dev');
  const [sslAutoRenew, setSslAutoRenew] = useState(settings?.sslAutoRenew ?? true);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;

    try {
      setIsSaving(true);
      await updateDomainSettings({
        domain: domain.trim(),
        sslAutoRenew,
      });
      queryClient.invalidateQueries({ queryKey: ['domain-settings'] });
      toast.success('Domain configuration updated');
    } catch {
      toast.error('Failed to update domain settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-border bg-card p-6">
      <CardHeader className="px-0 pt-0 pb-4">
        <SectionHeader
          icon={Globe}
          title="Cluster Hostname & SSL Configuration"
          description="Configure the primary web console domain and automatic Let's Encrypt TLS termination."
          action={
            settings?.sslActive && (
              <Badge
                variant="outline"
                className="bg-status-success/10 text-status-success border-status-success/30 font-mono text-xs gap-1"
              >
                <ShieldCheck className="size-3.5" />
                TLS Active
              </Badge>
            )
          }
        />
      </CardHeader>

      <form onSubmit={handleSave}>
        <CardContent className="px-0 space-y-5 pt-2">
          {/* Domain Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Control Plane Hostname</Label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="console.yourdomain.com"
              disabled={isSaving}
              className="max-w-md font-mono text-sm"
            />
          </div>

          {/* DNS Configuration Instructions */}
          <div className="p-4 rounded-lg border border-border bg-muted/20 text-sm space-y-2.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <span>Required DNS Pointer</span>
            </div>
            <p className="text-muted-foreground text-sm">
              Point your domain&apos;s DNS <code>A</code> record to your Tako cluster leader node:
            </p>
            <div className="flex items-center gap-2.5 font-mono text-sm bg-muted/60 px-3.5 py-2 rounded-md border border-border">
              <span className="text-muted-foreground">{domain}</span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
              <span className="font-semibold text-foreground">
                {leaderIp}
              </span>
            </div>
          </div>

          {/* SSL Auto-Renew Switch */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 py-6 border-t border-border">
            <div className="space-y-1.5 flex-1 min-w-0">
              <Label className="text-xs font-semibold text-foreground">
                Automatic Let&apos;s Encrypt SSL Certificates
              </Label>
              <p className="text-sm text-muted-foreground leading-relaxed sm:whitespace-nowrap">
                Automatically issue and renew TLS certificates before expiration via ACME HTTP-01 challenge.
              </p>
            </div>
            <Switch
              checked={sslAutoRenew}
              onCheckedChange={setSslAutoRenew}
              disabled={isSaving}
            />
          </div>
        </CardContent>

        <CardFooter className="px-0 pt-6 pb-0 flex justify-end border-t border-border">
          <Button
            type="submit"
            size="default"
            disabled={!domain.trim() || isSaving}
            className="text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 active:not-aria-[haspopup]:translate-y-px"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save Domain Settings
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
