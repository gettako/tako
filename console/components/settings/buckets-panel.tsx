'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getS3Buckets,
  addS3Bucket,
  updateS3Bucket,
  deleteS3Bucket,
  setDefaultS3Bucket,
  testS3BucketConnection,
} from '@/lib/api/settings';
import { S3Bucket } from '@/lib/types';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { SettingsSectionHeader } from '@/components/settings/settings-section-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HardDrive,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  MoreVertical,
  Pencil,
  Trash2,
  Star,
  Copy,
  Check,
  Activity,
  Cloud,
} from 'lucide-react';
import { toast } from 'sonner';

interface ConnectionStatus {
  ok: boolean;
  latencyMs: number;
  message: string;
}

export function BucketsPanel() {
  const queryClient = useQueryClient();

  // Dialog States
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<S3Bucket | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [bucket, setBucket] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Testing States
  const [testResult, setTestResult] = useState<ConnectionStatus | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [rowTestingId, setRowTestingId] = useState<string | null>(null);
  const [rowStatusMap, setRowStatusMap] = useState<Record<string, ConnectionStatus>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: buckets = [], isLoading } = useQuery({
    queryKey: ['s3-buckets'],
    queryFn: getS3Buckets,
  });

  // Mutations
  const addMutation = useMutation({
    mutationFn: addS3Bucket,
    onSuccess: (newB) => {
      queryClient.invalidateQueries({ queryKey: ['s3-buckets'] });
      toast.success(`Storage bucket "${newB.name}" configured`);
      setAddDialogOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to add S3 bucket'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Omit<S3Bucket, 'id' | 'createdAt'>> }) =>
      updateS3Bucket(id, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['s3-buckets'] });
      toast.success(`Storage bucket "${updated.name}" updated`);
      setEditDialogOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to update S3 bucket'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteS3Bucket,
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData(['s3-buckets'], (prev: S3Bucket[] | undefined) =>
        (prev || []).filter((b) => b.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: ['s3-buckets'] });
      toast.success('Storage bucket deleted');
      setDeleteDialogOpen(false);
      setSelectedBucket(null);
    },
    onError: () => toast.error('Failed to delete S3 bucket'),
  });

  const setDefaultMutation = useMutation({
    mutationFn: setDefaultS3Bucket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['s3-buckets'] });
      toast.success('Default storage bucket updated');
    },
    onError: () => toast.error('Failed to update default bucket'),
  });

  const resetForm = () => {
    setName('');
    setEndpoint('');
    setRegion('us-east-1');
    setBucket('');
    setAccessKeyId('');
    setSecretAccessKey('');
    setIsDefault(false);
    setTestResult(null);
    setSelectedBucket(null);
  };

  const openEditDialog = (b: S3Bucket) => {
    setSelectedBucket(b);
    setName(b.name);
    setEndpoint(b.endpoint);
    setRegion(b.region);
    setBucket(b.bucket);
    setAccessKeyId(b.accessKeyId);
    setSecretAccessKey('');
    setIsDefault(b.isDefault);
    setTestResult(null);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (b: S3Bucket) => {
    setSelectedBucket(b);
    setDeleteDialogOpen(true);
  };

  const handleTestConnection = async (
    ep = endpoint,
    bkt = bucket,
    reg = region,
    ak = accessKeyId,
    sk = secretAccessKey
  ) => {
    if (!ep || !bkt) {
      toast.error('Endpoint URL and bucket name are required to test connection');
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await testS3BucketConnection({
        endpoint: ep.trim(),
        bucket: bkt.trim(),
        region: reg.trim(),
        accessKeyId: ak.trim(),
        secretAccessKey: sk.trim(),
      });
      setTestResult(res);
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.error(res.message || 'Connection test failed');
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestRow = async (b: S3Bucket) => {
    try {
      setRowTestingId(b.id);
      const res = await testS3BucketConnection({
        endpoint: b.endpoint,
        bucket: b.bucket,
        region: b.region,
        accessKeyId: b.accessKeyId,
        secretAccessKey: b.secretAccessKey,
      });
      setRowStatusMap((prev) => ({ ...prev, [b.id]: res }));
      if (res.ok) {
        toast.success(`"${b.name}" connection verified (${res.latencyMs}ms)`);
      } else {
        toast.error(`"${b.name}" test failed: ${res.message}`);
      }
    } finally {
      setRowTestingId(null);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !endpoint.trim() || !bucket.trim() || !accessKeyId.trim()) return;

    addMutation.mutate({
      name: name.trim(),
      endpoint: endpoint.trim(),
      region: region.trim() || 'us-east-1',
      bucket: bucket.trim(),
      accessKeyId: accessKeyId.trim(),
      secretAccessKey: secretAccessKey.trim(),
      isDefault: isDefault || buckets.length === 0,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBucket || !name.trim() || !endpoint.trim() || !bucket.trim() || !accessKeyId.trim()) return;

    updateMutation.mutate({
      id: selectedBucket.id,
      input: {
        name: name.trim(),
        endpoint: endpoint.trim(),
        region: region.trim() || 'us-east-1',
        bucket: bucket.trim(),
        accessKeyId: accessKeyId.trim(),
        ...(secretAccessKey.trim() ? { secretAccessKey: secretAccessKey.trim() } : {}),
        isDefault,
      },
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Endpoint URL copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <SettingsSectionHeader
            icon={HardDrive}
            title="S3 Compatible Object Storage"
            description="Connect Cloudflare R2, AWS S3, MinIO, or DigitalOcean Spaces for persistent volume snapshots."
            action={
              <Button
                size="default"
                onClick={() => {
                  resetForm();
                  setIsDefault(buckets.length === 0);
                  setAddDialogOpen(true);
                }}
                className="text-sm h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 shrink-0 active:not-aria-[haspopup]:translate-y-px"
              >
                <Plus className="size-3.5" />
                Add S3 Bucket
              </Button>
            }
          />
        </CardHeader>

        <CardContent className="pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">Loading storage buckets...</span>
            </div>
          ) : buckets.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/10 space-y-3">
              <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground mx-auto">
                <Cloud className="size-6 opacity-60" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">No Storage Buckets Configured</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Add an S3 compatible object storage bucket to enable automated database and cluster state snapshots.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm();
                  setIsDefault(true);
                  setAddDialogOpen(true);
                }}
                className="text-xs h-8 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
              >
                <Plus className="size-3.5" />
                Configure First Bucket
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="h-10 hover:bg-transparent">
                    <TableHead className="w-[26%]">Storage Name</TableHead>
                    <TableHead className="w-[18%]">Bucket</TableHead>
                    <TableHead className="w-[28%]">Endpoint</TableHead>
                    <TableHead className="w-[12%]">Region</TableHead>
                    <TableHead className="w-[16%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buckets.map((b) => {
                    const rowStatus = rowStatusMap[b.id];
                    const isRowTesting = rowTestingId === b.id;

                    return (
                      <TableRow key={b.id} className="h-14 hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Cloud className="size-4 text-primary shrink-0" />
                            <span className="font-medium text-foreground">{b.name}</span>
                            {b.isDefault && (
                              <Badge
                                variant="outline"
                                className="bg-primary/10 text-primary border-primary/30 font-mono text-[11px] px-1.5 py-0"
                              >
                                Default
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-foreground">
                          {b.bucket}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 max-w-[260px]">
                            <span className="font-mono text-xs text-muted-foreground truncate">
                              {b.endpoint}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => copyToClipboard(b.endpoint, b.id)}
                              className="size-6 text-muted-foreground hover:text-foreground shrink-0 active:not-aria-[haspopup]:translate-y-px"
                              title="Copy Endpoint"
                            >
                              {copiedId === b.id ? (
                                <Check className="size-3 text-status-success" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          <span className="bg-muted px-2 py-0.5 rounded border border-border/60">
                            {b.region}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Inline Test Button */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestRow(b)}
                              disabled={isRowTesting}
                              className="h-8 px-2.5 text-xs gap-1.5 active:not-aria-[haspopup]:translate-y-px"
                              title="Test S3 connectivity"
                            >
                              {isRowTesting ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : rowStatus?.ok ? (
                                <CheckCircle2 className="size-3 text-status-success" />
                              ) : rowStatus && !rowStatus.ok ? (
                                <AlertCircle className="size-3 text-status-danger" />
                              ) : (
                                <Activity className="size-3 text-muted-foreground" />
                              )}
                              <span>{isRowTesting ? 'Testing' : rowStatus?.ok ? `${rowStatus.latencyMs}ms` : 'Test'}</span>
                            </Button>

                            {/* Dropdown Menu for CRUD */}
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-muted-foreground hover:text-foreground active:not-aria-[haspopup]:translate-y-px"
                                  />
                                }
                              >
                                <MoreVertical className="size-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                {!b.isDefault && (
                                  <DropdownMenuItem
                                    onClick={() => setDefaultMutation.mutate(b.id)}
                                    className="gap-2 cursor-pointer text-xs"
                                  >
                                    <Star className="size-3.5 text-amber-500" />
                                    <span>Set as Default</span>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => openEditDialog(b)}
                                  className="gap-2 cursor-pointer text-xs"
                                >
                                  <Pencil className="size-3.5" />
                                  <span>Edit Bucket</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog(b)}
                                  variant="destructive"
                                  className="gap-2 cursor-pointer text-xs text-status-danger"
                                >
                                  <Trash2 className="size-3.5" />
                                  <span>Delete Bucket</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add S3 Bucket Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleAddSubmit}>
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

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium text-foreground">Set as Default Storage</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Use this storage bucket as the primary target for automated snapshots.
                  </p>
                </div>
                <Switch
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                  disabled={buckets.length === 0}
                />
              </div>

              {/* Live Test Connection Result */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg border flex items-center gap-2.5 text-xs ${
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
                  <span className="flex-1">{testResult.message}</span>
                  {testResult.ok && (
                    <span className="font-mono shrink-0">
                      {testResult.latencyMs}ms
                    </span>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleTestConnection()}
                disabled={isTesting || !endpoint || !bucket}
                className="text-xs h-9 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
              >
                {isTesting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5 text-primary" />
                )}
                Test Connection
              </Button>

              <div className="flex items-center gap-2 sm:gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddDialogOpen(false)}
                  className="text-xs h-9 active:not-aria-[haspopup]:translate-y-px"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!name || !endpoint || !bucket || !accessKeyId || addMutation.isPending}
                  className="text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium active:not-aria-[haspopup]:translate-y-px"
                >
                  {addMutation.isPending ? 'Saving...' : 'Save Storage'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit S3 Bucket Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Edit S3 Storage Bucket
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Update connection parameters or credentials for this storage bucket.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Display Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">S3 Endpoint URL</Label>
                <Input
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
                    value={bucket}
                    onChange={(e) => setBucket(e.target.value)}
                    required
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Region</Label>
                  <Input
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Access Key ID</Label>
                <Input
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
                  placeholder="Leave blank to preserve existing key"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium text-foreground">Set as Default Storage</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Mark as primary snapshot destination for Tako cluster backups.
                  </p>
                </div>
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-lg border flex items-center gap-2.5 text-xs ${
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
                  <span className="flex-1">{testResult.message}</span>
                  {testResult.ok && (
                    <span className="font-mono shrink-0">
                      {testResult.latencyMs}ms
                    </span>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  handleTestConnection(
                    endpoint,
                    bucket,
                    region,
                    accessKeyId,
                    secretAccessKey || selectedBucket?.secretAccessKey || ''
                  )
                }
                disabled={isTesting || !endpoint || !bucket}
                className="text-xs h-9 gap-1.5 active:not-aria-[haspopup]:translate-y-px"
              >
                {isTesting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5 text-primary" />
                )}
                Test Connection
              </Button>

              <div className="flex items-center gap-2 sm:gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDialogOpen(false)}
                  className="text-xs h-9 active:not-aria-[haspopup]:translate-y-px"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!name || !endpoint || !bucket || !accessKeyId || updateMutation.isPending}
                  className="text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium active:not-aria-[haspopup]:translate-y-px"
                >
                  {updateMutation.isPending ? 'Updating...' : 'Save Changes'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete S3 Bucket Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-status-danger">
              Delete Storage Bucket
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Are you sure you want to remove &ldquo;{selectedBucket?.name}&rdquo;?
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-xs text-muted-foreground space-y-2">
            <p>
              This will disconnect the bucket from Tako cluster settings. Any existing files stored in your remote S3 bucket will not be deleted, but automated backups targeted to this bucket will stop until a new bucket is selected.
            </p>
            {selectedBucket?.isDefault && (
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                Note: This bucket is currently set as the default snapshot destination.
              </p>
            )}
          </div>

          <DialogFooter className="flex-row justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
              className="text-xs h-9 active:not-aria-[haspopup]:translate-y-px"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (selectedBucket) {
                  deleteMutation.mutate(selectedBucket.id);
                }
              }}
              className="text-xs h-9 active:not-aria-[haspopup]:translate-y-px"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
