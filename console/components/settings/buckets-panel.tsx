'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getS3Buckets, addS3Bucket, testS3BucketConnection } from '@/lib/api/settings';
import { S3Bucket } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HardDrive, Plus, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { toast } from 'sonner';

export function BucketsPanel() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [bucket, setBucket] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const { data: buckets = [], isLoading } = useQuery({
    queryKey: ['s3-buckets'],
    queryFn: getS3Buckets,
  });

  const addMutation = useMutation({
    mutationFn: addS3Bucket,
    onSuccess: (newB) => {
      queryClient.invalidateQueries({ queryKey: ['s3-buckets'] });
      toast.success(`Storage bucket "${newB.name}" configured`);
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to add S3 bucket'),
  });

  const resetForm = () => {
    setName('');
    setEndpoint('');
    setRegion('us-east-1');
    setBucket('');
    setAccessKeyId('');
    setSecretAccessKey('');
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!endpoint || !bucket) {
      toast.error('Endpoint and bucket name are required to test connection');
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await testS3BucketConnection({ endpoint, bucket });
      setTestResult(res);
      if (res.ok) {
        toast.success(`Connection verified (${res.latencyMs}ms)`);
      } else {
        toast.error('Connection test failed');
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !endpoint.trim() || !bucket.trim() || !accessKeyId.trim()) return;

    addMutation.mutate({
      name: name.trim(),
      endpoint: endpoint.trim(),
      region: region.trim() || 'us-east-1',
      bucket: bucket.trim(),
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
      isDefault: buckets.length === 0,
    });
  };

  return (
    <>
      <Card className="border-border bg-card p-6">
        <CardHeader className="px-0 pt-0 pb-4">
          <SectionHeader
            icon={HardDrive}
            title="S3 Compatible Object Storage"
            description="Connect Cloudflare R2, AWS S3, MinIO, or DigitalOcean Spaces for persistent volume snapshots."
            action={
              <Button
                size="default"
                onClick={() => {
                  resetForm();
                  setDialogOpen(true);
                }}
                className="text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 shrink-0 active:not-aria-[haspopup]:translate-y-px"
              >
                <Plus className="size-3.5" />
                Add S3 Bucket
              </Button>
            }
          />
        </CardHeader>

        <CardContent className="px-0 pt-2">
          {buckets.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg">
              <HardDrive className="size-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No S3 storage buckets configured.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40 border-b border-border">
                  <TableRow className="h-10 hover:bg-transparent">
                    <TableHead className="w-[25%]">Storage Name</TableHead>
                    <TableHead className="w-[20%]">Bucket</TableHead>
                    <TableHead className="w-[30%]">Endpoint</TableHead>
                    <TableHead className="w-[15%]">Region</TableHead>
                    <TableHead className="w-[10%] text-right">Default</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buckets.map((b) => (
                    <TableRow key={b.id} className="h-14 border-b border-border hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-foreground">
                        {b.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-foreground">
                        {b.bucket}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground truncate max-w-xs">
                        {b.endpoint}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {b.region}
                      </TableCell>
                      <TableCell className="text-right">
                        {b.isDefault && (
                          <Badge
                            variant="outline"
                            className="bg-primary/10 text-primary border-primary/30 font-mono text-xs"
                          >
                            Default
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add S3 Bucket Dialog (AC-9) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Configure S3 Compatible Storage
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Enter your bucket credentials and test connectivity before saving.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Display Name</Label>
                <Input
                  placeholder="e.g. Primary Backups (Cloudflare R2)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">S3 Endpoint URL</Label>
                <Input
                  placeholder="https://<account>.r2.cloudflarestorage.com"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  required
                  className="font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Bucket Name</Label>
                  <Input
                    placeholder="my-tako-backups"
                    value={bucket}
                    onChange={(e) => setBucket(e.target.value)}
                    required
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Region</Label>
                  <Input
                    placeholder="e.g. us-east-1 or auto"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Access Key ID</Label>
                <Input
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  required
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Secret Access Key</Label>
                <Input
                  type="password"
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              {/* Simulated Test Connection Result */}
              {testResult && (
                <div
                  className={`p-3 rounded-md border flex items-center gap-2.5 text-sm ${
                    testResult.ok
                      ? 'border-status-success/30 bg-status-success/10 text-status-success'
                      : 'border-status-danger/30 bg-status-danger/10 text-status-danger'
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="size-4 shrink-0" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0" />
                  )}
                  <span className="flex-1 text-sm">{testResult.message}</span>
                  {testResult.ok && (
                    <span className="font-mono text-sm shrink-0">
                      {testResult.latencyMs}ms
                    </span>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={handleTestConnection}
                disabled={isTesting || !endpoint || !bucket}
                className="text-sm h-9 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
              >
                {isTesting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5 text-primary" />
                )}
                Test Connection
              </Button>

              <Button
                type="submit"
                size="default"
                disabled={!name || !endpoint || !bucket || !accessKeyId || addMutation.isPending}
                className="text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium active:not-aria-[haspopup]:translate-y-px"
              >
                {addMutation.isPending ? 'Saving...' : 'Save Storage'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
