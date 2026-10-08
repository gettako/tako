'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDomainSettings, updateDomainSettings, verifyDomainAndSSL } from '@/lib/api/settings';
import { getNodes } from '@/lib/api/nodes';
import { DomainVerificationResult } from '@/lib/types';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Globe,
  ShieldCheck,
  Save,
  Loader2,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  Info,
  Lock,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import {
  sanitizeDomain,
  validateDomain,
  formatDnsInstructions,
  getSslStatusBadge,
} from '@/lib/utils/domain-validator';
import { toast } from 'sonner';

export function DomainPanel() {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [showCustomIp, setShowCustomIp] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['domain-settings'],
    queryFn: getDomainSettings,
  });

  const { data: nodes = [] } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
  });

  const leaderNode = nodes.find((n) => n.role === 'leader') || nodes[0];
  const detectedLeaderIp = leaderNode?.publicIp || leaderNode?.ipAddress || '127.0.0.1';

  const [domain, setDomain] = useState(settings?.domain ?? 'console.gettako.dev');
  const [sslAutoRenew, setSslAutoRenew] = useState(settings?.sslAutoRenew ?? true);
  const [customDnsIp, setCustomDnsIp] = useState(settings?.customDnsIp ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<DomainVerificationResult | null>(null);

  useEffect(() => {
    if (settings) {
      if (settings.domain) setDomain(settings.domain);
      if (typeof settings.sslAutoRenew === 'boolean') setSslAutoRenew(settings.sslAutoRenew);
      if (settings.customDnsIp) {
        setCustomDnsIp(settings.customDnsIp);
        setShowCustomIp(true);
      }
    }
  }, [settings]);

  const effectiveLeaderIp = customDnsIp.trim() || detectedLeaderIp;
  const dnsConfig = formatDnsInstructions(domain, effectiveLeaderIp);

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
    const valRes = validateDomain(cleaned);
    if (!valRes.valid) {
      setValidationError(valRes.error || 'Invalid domain format');
      toast.error(valRes.error || 'Please enter a valid domain');
      return;
    }

    try {
      setIsSaving(true);
      await updateDomainSettings({
        domain: cleaned,
        sslAutoRenew,
        customDnsIp: customDnsIp.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['domain-settings'] });
      toast.success('Domain configuration updated and saved');
    } catch {
      toast.error('Failed to update domain settings');
    } finally {
      setIsSaving(false);
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
      const res = await verifyDomainAndSSL(cleaned, effectiveLeaderIp);
      setVerificationResult(res);
      queryClient.invalidateQueries({ queryKey: ['domain-settings'] });

      if (res.dnsVerified && res.sslActive) {
        toast.success(`Domain ${cleaned} DNS verified and SSL TLS is active!`);
      } else if (res.dnsVerified) {
        toast.info(`DNS verified! Let's Encrypt TLS issuance in progress via Traefik.`);
      } else {
        toast.warning(res.message || 'DNS record not pointing to cluster leader IP yet.');
      }
    } catch {
      toast.error('Failed to verify domain connectivity');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyIp = () => {
    navigator.clipboard.writeText(effectiveLeaderIp);
    setCopiedIp(true);
    toast.success('Cluster IP copied to clipboard');
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(domain);
    setCopiedDomain(true);
    toast.success('Domain hostname copied');
    setTimeout(() => setCopiedDomain(false), 2000);
  };

  const currentStatus = verificationResult?.sslStatus || settings?.sslStatus || (settings?.sslActive ? 'active' : 'pending_dns');
  const badgeConfig = getSslStatusBadge(currentStatus, settings?.sslActive || verificationResult?.sslActive);

  return (
    <Card className="border-border bg-card p-6">
      <CardHeader className="px-0 pt-0 pb-4">
        <SectionHeader
          icon={Globe}
          title="Cluster Hostname & SSL Configuration"
          description="Configure the primary web console domain and automatic Let's Encrypt TLS termination."
          action={
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
          }
        />
      </CardHeader>

      <form onSubmit={handleSave}>
        <CardContent className="px-0 space-y-6 pt-2">
          {/* Domain Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground">Control Plane Hostname</Label>
              {domain && (
                <a
                  href={`https://${sanitizeDomain(domain)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 font-mono transition-colors"
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
              <span className="text-xs text-muted-foreground">TTL: 300 seconds recommended</span>
            </div>

            <p className="text-muted-foreground text-xs leading-relaxed">
              Create an <strong>A Record</strong> in your DNS provider (Cloudflare, Route53, Namecheap, etc.) pointing your hostname to the cluster ingress node:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg border border-border bg-card">
                <span className="text-muted-foreground text-[10px] block uppercase font-sans">Type</span>
                <span className="font-semibold text-foreground">A</span>
              </div>

              <div className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground text-[10px] block uppercase font-sans">Name / Host</span>
                  <span className="font-semibold text-foreground truncate">{dnsConfig.host}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyDomain}
                  className="size-6 text-muted-foreground hover:text-foreground shrink-0"
                  title="Copy hostname"
                >
                  {copiedDomain ? <Check className="size-3 text-status-success" /> : <Copy className="size-3" />}
                </Button>
              </div>

              <div className="sm:col-span-2 p-2.5 rounded-lg border border-border bg-card flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-muted-foreground text-[10px] block uppercase font-sans">Points to (Target IP)</span>
                  <span className="font-semibold text-foreground truncate select-all">{effectiveLeaderIp}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyIp}
                  className="size-6 text-muted-foreground hover:text-foreground shrink-0"
                  title="Copy IP"
                >
                  {copiedIp ? <Check className="size-3 text-status-success" /> : <Copy className="size-3" />}
                </Button>
              </div>
            </div>

            {/* Pointer Quick View */}
            <div className="flex items-center gap-2.5 font-mono text-xs bg-muted/60 px-3.5 py-2 rounded-lg border border-border flex-wrap">
              <span className="text-muted-foreground">{sanitizeDomain(domain) || 'console.gettako.dev'}</span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
              <span className="font-semibold text-foreground">{effectiveLeaderIp}</span>
              <span className="text-[11px] text-muted-foreground ml-auto">
                Node: {leaderNode?.name || 'cluster-leader'}
              </span>
            </div>

            {/* Custom DNS IP toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowCustomIp(!showCustomIp)}
                className="text-xs text-primary hover:underline font-medium"
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
                  Automatically provisions and renews SSL/TLS certificates via Traefik ACME HTTP-01 challenge before expiration.
                </p>
              </div>
              <Switch
                checked={sslAutoRenew}
                onCheckedChange={setSslAutoRenew}
                disabled={isSaving}
              />
            </div>

            {/* Certificate telemetry summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
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
                <span className="text-muted-foreground text-[11px]">ACME Challenge</span>
                <div className="font-semibold text-foreground font-mono">HTTP-01 Challenge</div>
                <div className="text-[10px] text-muted-foreground">Requires open port 80</div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="px-0 pt-6 pb-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border">
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
