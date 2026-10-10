'use client';

import React, { useState, useEffect } from 'react';
import {
  useDomainSettings,
  useUpdateDomainSettings,
  useVerifyDomainAndSSL,
  useNodes,
  useReloadNodeTraefik,
} from '@/lib/queries';
import { DomainVerificationResult } from '@/lib/types';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { SettingsSectionHeader } from '@/components/settings/settings-section-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/ui/copy-button';
import {
  Globe,
  ShieldCheck,
  Save,
  Loader2,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Info,
  Lock,
  RotateCw,
} from 'lucide-react';
import {
  sanitizeDomain,
  validateDomain,
  formatDnsInstructions,
  getSslStatusBadge,
} from '@/lib/utils/domain-validator';
import { toast } from 'sonner';

export function DomainPanel() {
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isReloadingTraefik, setIsReloadingTraefik] = useState(false);
  const [showCustomIp, setShowCustomIp] = useState(false);

  const { data: settings } = useDomainSettings();
  const { data: nodes = [] } = useNodes();
  const updateDomainSettingsMutation = useUpdateDomainSettings();
  const verifyDomainAndSSLMutation = useVerifyDomainAndSSL();
  const reloadNodeTraefikMutation = useReloadNodeTraefik();

  const leaderNode = nodes.find((n) => n.role === 'leader') || nodes[0];
  const detectedLeaderIp = leaderNode?.publicIp || leaderNode?.ipAddress || '127.0.0.1';

  const [domain, setDomain] = useState('');
  const [sslAutoRenew, setSslAutoRenew] = useState(true);
  const [dnsProvider, setDnsProvider] = useState<'http01' | 'cloudflare'>('http01');
  const [cloudflareApiToken, setCloudflareApiToken] = useState('');
  const [customDnsIp, setCustomDnsIp] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<DomainVerificationResult | null>(null);

  useEffect(() => {
    if (settings) {
      if (typeof settings.domain === 'string') setDomain(settings.domain);
      if (typeof settings.sslAutoRenew === 'boolean') setSslAutoRenew(settings.sslAutoRenew);
      if (settings.dnsProvider) setDnsProvider(settings.dnsProvider);
      if (settings.cloudflareApiToken) setCloudflareApiToken(settings.cloudflareApiToken);
      if (settings.customDnsIp) {
        setCustomDnsIp(settings.customDnsIp);
        setShowCustomIp(true);
      }
    }
  }, [settings]);

  const effectiveLeaderIp = customDnsIp.trim() || detectedLeaderIp;
  const cleanDomain = sanitizeDomain(domain);
  const dnsConfig = formatDnsInstructions(cleanDomain, effectiveLeaderIp);

  const handleDomainChange = (val: string) => {
    setDomain(val);
    const cleaned = sanitizeDomain(val);
    if (!cleaned) {
      setValidationError('Domain name cannot be empty');
    } else {
      const res = validateDomain(cleaned);
      setValidationError(res.valid ? null : res.error || 'Invalid domain format');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeDomain(domain);
    if (!cleaned) {
      setValidationError('Domain name cannot be empty');
      toast.error('Please enter a valid domain name');
      return;
    }

    const valRes = validateDomain(cleaned);
    if (!valRes.valid) {
      setValidationError(valRes.error || 'Invalid domain format');
      toast.error(valRes.error || 'Please enter a valid domain');
      return;
    }

    try {
      setIsSaving(true);
      await updateDomainSettingsMutation.mutateAsync({
        domain: cleaned,
        sslAutoRenew,
        dnsProvider,
        cloudflareApiToken: dnsProvider === 'cloudflare' ? cloudflareApiToken.trim() : undefined,
        customDnsIp: customDnsIp.trim() || undefined,
      });

      // Automatically verify DNS connectivity & SSL
      try {
        const verifyRes = await verifyDomainAndSSLMutation.mutateAsync({
          domain: cleaned,
          expectedIp: effectiveLeaderIp,
        });
        setVerificationResult(verifyRes);

        if (verifyRes.dnsVerified && verifyRes.sslActive) {
          toast.success(`Domain ${cleaned} saved and TLS verified!`);
        } else if (verifyRes.dnsVerified) {
          toast.success(`Domain saved! DNS points to leader, TLS issuance in progress.`);
        } else {
          toast.info(`Domain saved! Set your DNS A record to point to ${effectiveLeaderIp}.`);
        }
      } catch {
        toast.success(`Domain configuration updated and saved for ${cleaned}.`);
      }
    } catch {
      // Error handled by mutation
    } finally {
      setIsSaving(false);
    }
  };

  const handleReloadTraefik = async () => {
    if (!leaderNode?.id) {
      toast.error('No cluster node found');
      return;
    }
    try {
      setIsReloadingTraefik(true);
      await reloadNodeTraefikMutation.mutateAsync(leaderNode.id);
    } finally {
      setIsReloadingTraefik(false);
    }
  };

  const handleVerify = async () => {
    const cleaned = sanitizeDomain(domain);
    const valRes = validateDomain(cleaned);
    if (!valRes.valid) {
      toast.error('Please enter a valid domain before testing');
      return;
    }

    try {
      setIsVerifying(true);
      const res = await verifyDomainAndSSLMutation.mutateAsync({
        domain: cleaned,
        expectedIp: effectiveLeaderIp,
      });
      setVerificationResult(res);

      if (res.dnsVerified && res.sslActive) {
        toast.success(`Domain & TLS certificate are active and verified!`);
      } else if (res.dnsVerified) {
        toast.warning(
          `DNS points correctly to ${effectiveLeaderIp}, but SSL certificate is pending or invalid.`
        );
        const resolvedText = res.resolvedIps && res.resolvedIps.length > 0 ? res.resolvedIps.join(', ') : 'unknown';
        toast.error(
          `DNS check failed: ${cleaned} resolves to ${resolvedText}, expected ${effectiveLeaderIp}.`
        );
      }
    } catch {
      toast.error('Failed to verify domain connectivity');
    } finally {
      setIsVerifying(false);
    }
  };

  const currentStatus =
    verificationResult?.sslStatus ||
    settings?.sslStatus ||
    (settings?.sslActive ? 'active' : 'pending_dns');
  const badgeConfig = getSslStatusBadge(
    currentStatus,
    settings?.sslActive || verificationResult?.sslActive
  );

  return (
    <Card>
      <form onSubmit={handleSave}>
        <CardHeader className="pb-4">
          <SettingsSectionHeader
            icon={Globe}
            title="Cluster Hostname & SSL Configuration"
            description="Configure the primary web console domain, wildcard routes, and Let's Encrypt TLS termination."
            action={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReloadTraefik}
                  disabled={isReloadingTraefik}
                  className="h-7 text-xs font-medium gap-1.5 border-border"
                  title="Reload Traefik dynamic routing and ACME certificate resolver"
                >
                  {isReloadingTraefik ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RotateCw className="size-3" />
                  )}
                  <span>Reload Traefik</span>
                </Button>
                <Badge
                  variant="outline"
                  className={
                    badgeConfig.variant === 'success'
                      ? 'bg-status-success/10 text-status-success border-status-success/30 font-mono text-xs gap-1'
                      : badgeConfig.variant === 'warning'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-mono text-xs gap-1'
                        : 'bg-primary/10 text-primary border-primary/30 font-mono text-xs gap-1'
                  }
                >
                  {badgeConfig.variant === 'success' ? (
                    <ShieldCheck className="size-3.5" />
                  ) : (
                    <Lock className="size-3.5" />
                  )}
                  {badgeConfig.label}
                </Badge>
              </div>
            }
          />
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Domain Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground">Control Plane Hostname</Label>
              {domain && (
                <a
                  href={`https://${sanitizeDomain(domain)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 font-mono transition-colors active:not-aria-[haspopup]:translate-y-px"
                >
                  <span>https://{sanitizeDomain(domain)}</span>
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1 max-w-lg">
                <Input
                  value={domain}
                  onChange={(e) => handleDomainChange(e.target.value)}
                  onBlur={() => setDomain(sanitizeDomain(domain))}
                  placeholder="console.yourdomain.com"
                  disabled={isSaving || isVerifying}
                  className={`font-mono text-sm ${validationError ? 'border-status-danger focus-visible:ring-status-danger' : ''}`}
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={handleVerify}
                disabled={isVerifying || isSaving || !domain.trim() || !!validationError}
                className="text-xs h-9 font-medium gap-1.5 shrink-0 active:not-aria-[haspopup]:translate-y-px"
                title="Verify DNS record propagation and check SSL reachability"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-3.5 text-muted-foreground" />
                    Verify DNS & SSL
                  </>
                )}
              </Button>
            </div>

            {validationError ? (
              <p className="text-xs text-status-danger flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{validationError}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Enter your fully qualified domain name (FQDN). Protocols (<code>https://</code>) and trailing slashes are automatically sanitized.
              </p>
            )}
          </div>

          {/* Verification Status Alert Banner */}
          {verificationResult && (
            <div
              className={`p-4 rounded-xl border text-sm space-y-1.5 transition-all ${
                verificationResult.dnsVerified && verificationResult.sslActive
                  ? 'border-status-success/30 bg-status-success/10 text-status-success'
                  : verificationResult.dnsVerified
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}
            >
              <div className="font-semibold flex items-center gap-2">
                {verificationResult.dnsVerified && verificationResult.sslActive ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : verificationResult.dnsVerified ? (
                  <Info className="size-4 shrink-0" />
                ) : (
                  <AlertCircle className="size-4 shrink-0" />
                )}
                <span>
                  {verificationResult.dnsVerified && verificationResult.sslActive
                    ? 'Verification Successful: Cluster Hostname & SSL Active'
                    : verificationResult.dnsVerified
                      ? 'DNS Pointer Confirmed — Let’s Encrypt ACME Negotiation In Progress'
                      : 'DNS A Record Not Detected Or Mismatched'}
                </span>
              </div>
              <p className="text-xs leading-relaxed opacity-90">{verificationResult.message}</p>
              {verificationResult.sslIssuer && (
                <div className="text-xs font-mono opacity-80 pt-1">
                  Certificate Issuer: {verificationResult.sslIssuer} • Checked at{' '}
                  {new Date(verificationResult.lastCheckedAt).toLocaleTimeString()}
                </div>
              )}
            </div>
          )}

          {/* DNS Configuration Instructions */}
          <div className="p-4 sm:p-5 rounded-xl border border-border bg-muted/20 text-sm space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <Globe className="size-4 text-primary" />
                <span>Required DNS Configuration</span>
              </div>
              <span className="text-xs text-muted-foreground font-mono">TTL: 300s recommended</span>
            </div>

            <p className="text-muted-foreground text-xs leading-relaxed">
              {cleanDomain ? (
                <>
                  Create an <strong>A Record</strong> in your DNS provider (Cloudflare, Route53, Namecheap, etc.) pointing{' '}
                  <strong className="font-mono text-foreground">{cleanDomain}</strong> to your cluster ingress node:
                </>
              ) : (
                <>
                  Enter your domain name above to generate exact DNS record details, or configure an{' '}
                  <strong>A Record</strong> pointing your hostname to the cluster ingress node:
                </>
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg border border-border bg-card">
                <span className="text-muted-foreground text-[10px] block uppercase font-sans">Type</span>
                <span className="font-semibold text-foreground">A</span>
              </div>

              <div className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground text-[10px] block uppercase font-sans">Name / Host</span>
                  <span className="font-semibold text-foreground truncate">
                    {cleanDomain ? dnsConfig.host : '@ (or subdomain)'}
                  </span>
                </div>
                {cleanDomain && (
                  <CopyButton
                    text={cleanDomain}
                    size="sm"
                    className="size-6 text-muted-foreground hover:text-foreground shrink-0"
                    title="Copy hostname"
                  />
                )}
              </div>

              <div className="sm:col-span-2 p-2.5 rounded-lg border border-border bg-card flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-muted-foreground text-[10px] block uppercase font-sans">Points to (Target IP)</span>
                  <span className="font-semibold text-foreground truncate select-all">{effectiveLeaderIp}</span>
                </div>
                <CopyButton
                  text={effectiveLeaderIp}
                  size="sm"
                  className="size-6 text-muted-foreground hover:text-foreground shrink-0"
                  title="Copy IP"
                />
              </div>
            </div>

            {/* Pointer Quick View */}
            {cleanDomain ? (
              <div className="flex items-center gap-2.5 font-mono text-xs bg-muted/60 px-3.5 py-2 rounded-lg border border-border flex-wrap">
                <span className="text-foreground font-semibold">{cleanDomain}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className="font-semibold text-foreground">{effectiveLeaderIp}</span>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  Node: {leaderNode?.name || 'cluster-leader'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 text-xs bg-muted/60 px-3.5 py-2 rounded-lg border border-border flex-wrap text-muted-foreground">
                <span className="font-mono text-[11px]">your-domain.com</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className="font-mono font-semibold text-foreground">{effectiveLeaderIp}</span>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  Enter hostname in the field above to verify
                </span>
              </div>
            )}

            {/* Custom DNS IP toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowCustomIp(!showCustomIp)}
                className="text-xs text-primary hover:underline font-medium active:not-aria-[haspopup]:translate-y-px"
              >
                {showCustomIp ? 'Hide custom DNS IP override' : 'Need a custom DNS IP (e.g. Cloudflare / proxy)?'}
              </button>

              {showCustomIp && (
                <div className="mt-2.5 space-y-1.5 max-w-sm">
                  <Label className="text-xs text-muted-foreground">Custom Ingress IP / Load Balancer IP</Label>
                  <Input
                    value={customDnsIp}
                    onChange={(e) => setCustomDnsIp(e.target.value.trim())}
                    placeholder="e.g. 1.2.3.4"
                    className="font-mono text-xs h-8"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Leave blank to use detected cluster node IP ({detectedLeaderIp}).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SSL Auto-Renew & Let's Encrypt Information */}
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <Label className="text-xs font-semibold text-foreground">
                    Automatic Let&apos;s Encrypt TLS Certificates
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automatically provisions and renews SSL/TLS certificates via Traefik ACME before expiration.
                </p>
              </div>
              <Switch
                checked={sslAutoRenew}
                onCheckedChange={setSslAutoRenew}
                disabled={isSaving}
              />
            </div>

            {/* ACME Challenge Provider Selector */}
            <div className="space-y-3 pt-2">
              <Label className="text-xs font-medium text-foreground">ACME DNS Challenge Provider</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setDnsProvider('http01')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    dnsProvider === 'http01'
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-card hover:bg-muted/30 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">HTTP-01 Challenge</span>
                    {dnsProvider === 'http01' && <CheckCircle2 className="size-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Standard challenge. Perfect for apex domains and direct subdomains (requires open port 80).
                  </p>
                </div>

                <div
                  onClick={() => setDnsProvider('cloudflare')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    dnsProvider === 'cloudflare'
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-card hover:bg-muted/30 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Cloudflare DNS-01 Challenge</span>
                    {dnsProvider === 'cloudflare' && <CheckCircle2 className="size-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Required for Wildcard Certificates (<code>*.gettako.dev</code>). Automated via Cloudflare API.
                  </p>
                </div>
              </div>

              {dnsProvider === 'cloudflare' && (
                <div className="space-y-1.5 pt-2 max-w-md">
                  <Label className="text-xs font-medium text-foreground">Cloudflare API Token</Label>
                  <Input
                    type="password"
                    value={cloudflareApiToken}
                    onChange={(e) => setCloudflareApiToken(e.target.value)}
                    placeholder="Enter Cloudflare Zone:DNS API Token"
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Token with permissions: <code>Zone:DNS:Edit</code> and <code>Zone:Zone:Read</code>.
                  </p>
                </div>
              )}
            </div>

            {/* Certificate telemetry summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-muted-foreground text-[11px]">Cert Resolver</span>
                <div className="font-semibold text-foreground font-mono">Traefik Let&apos;s Encrypt</div>
                <div className="text-[10px] text-muted-foreground">Port 80 / 443 Ingress</div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-muted-foreground text-[11px]">Auto-Renewal Period</span>
                <div className="font-semibold text-foreground">Every 60 Days</div>
                <div className="text-[10px] text-muted-foreground">Zero downtime renewal</div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <span className="text-muted-foreground text-[11px]">Active Challenge</span>
                <div className="font-semibold text-foreground font-mono">
                  {dnsProvider === 'cloudflare' ? 'Cloudflare DNS-01' : 'HTTP-01 Challenge'}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {dnsProvider === 'cloudflare' ? 'Supports *.wildcard TLS' : 'Requires open port 80'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border pt-6 mt-6">
          <p className="text-xs text-muted-foreground">
            Changes take effect immediately on cluster edge routing.
          </p>

          <Button
            type="submit"
            size="default"
            disabled={!domain.trim() || isSaving || !!validationError}
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
