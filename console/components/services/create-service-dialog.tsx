'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Layers,
  Boxes,
  GitBranch,
  Lock,
  Globe,
  Plus,
  Loader2,
  Check,
  Server,
  FolderGit2,
  Cpu,
  HardDrive,
  ArrowRight,
  ArrowLeft,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { createService } from '@/lib/api/services';
import { getProjects } from '@/lib/api/projects';
import { getNodes } from '@/lib/api/nodes';
import { getGitProviders, getSyncedRepos } from '@/lib/api/settings';
import { Service, ServiceType, CreateServiceInput, Node } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

// Helper to interpolate position index from a numeric value
function getStepIndex(val: number, steps: number[]): number {
  if (!steps.length) return 0;
  if (val <= steps[0]) return 0;
  if (val >= steps[steps.length - 1]) return steps.length - 1;

  for (let i = 0; i < steps.length - 1; i++) {
    if (val === steps[i]) return i;
    if (val > steps[i] && val < steps[i + 1]) {
      const frac = (val - steps[i]) / (steps[i + 1] - steps[i]);
      return i + frac;
    }
  }
  return steps.length - 1;
}

export interface CreateServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onSuccess?: (service: Service) => void;
}

export function CreateServiceDialog({
  open,
  onOpenChange,
  projectId: initialProjectId,
  onSuccess,
}: CreateServiceDialogProps) {
  const queryClient = useQueryClient();

  // Wizard Step: 1 = Service & Source, 2 = Node & Resources
  const [step, setStep] = useState<1 | 2>(1);

  // Queries
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    enabled: open,
  });

  const { data: nodes = [] } = useQuery({
    queryKey: ['nodes'],
    queryFn: getNodes,
    enabled: open,
  });

  const { data: gitProviders = [] } = useQuery({
    queryKey: ['git-providers'],
    queryFn: getGitProviders,
    enabled: open,
  });

  const { data: syncedRepos = [] } = useQuery({
    queryKey: ['synced-repos'],
    queryFn: getSyncedRepos,
    enabled: open,
  });

  // Automatically determine project from props or fallback
  const resolvedProjectId = initialProjectId || projects[0]?.id || '';
  const currentProject = projects.find((p) => p.id === resolvedProjectId) || projects[0];

  // Form State - Step 1
  const [serviceType, setServiceType] = useState<ServiceType>('app');
  const [sourceMode, setSourceMode] = useState<'account' | 'url'>('account');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [customGitUrl, setCustomGitUrl] = useState<string>('');
  const [branch, setBranch] = useState<string>('main');

  const [name, setName] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [isSlugTouched, setIsSlugTouched] = useState<boolean>(false);

  // App specific config
  const [port, setPort] = useState<string>('3000');
  const [publishToHost, setPublishToHost] = useState<boolean>(true);
  const [dockerfilePath, setDockerfilePath] = useState<string>('Dockerfile');

  // Compose specific config
  const [composeFilePath, setComposeFilePath] = useState<string>('docker-compose.yml');

  // Form State - Step 2 (Node & Allocation)
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [cpuCores, setCpuCores] = useState<number>(1);
  const [memoryMb, setMemoryMb] = useState<number>(1024);

  // Validation errors
  const [nameError, setNameError] = useState<string>('');
  const [slugError, setSlugError] = useState<string>('');
  const [urlError, setUrlError] = useState<string>('');
  const [repoError, setRepoError] = useState<string>('');
  const [nodeError, setNodeError] = useState<string>('');

  // Initial defaults on open
  useEffect(() => {
    if (open) {
      if (gitProviders.length > 0 && !selectedAccountId) {
        setSelectedAccountId(gitProviders[0].id);
      }

      if (nodes.length > 0 && !selectedNodeId) {
        // Prefer first online worker node, or fallback to any available node
        const defaultWorker = nodes.find((n) => n.role === 'worker' && n.status === 'online') || nodes[0];
        if (defaultWorker) {
          setSelectedNodeId(defaultWorker.id);
        }
      }
    }
  }, [open, gitProviders, nodes, selectedAccountId, selectedNodeId]);

  // Filter repositories based on selected account
  const accountRepos = syncedRepos.filter(
    (repo) => !selectedAccountId || repo.providerId === selectedAccountId
  );

  const resetForm = () => {
    setStep(1);
    setServiceType('app');
    setSourceMode('account');
    setSelectedRepoId('');
    setCustomGitUrl('');
    setBranch('main');
    setName('');
    setSlug('');
    setIsSlugTouched(false);
    setPort('3000');
    setPublishToHost(true);
    setDockerfilePath('Dockerfile');
    setComposeFilePath('docker-compose.yml');
    setCpuCores(1);
    setMemoryMb(1024);
    setNameError('');
    setSlugError('');
    setUrlError('');
    setRepoError('');
    setNodeError('');
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  // Handle repository selection from account
  const handleRepoChange = (repoId: string) => {
    setSelectedRepoId(repoId);
    setRepoError('');
    const repo = syncedRepos.find((r) => r.id === repoId);
    if (repo) {
      if (!name) {
        setName(repo.name);
      }
      if (!isSlugTouched) {
        setSlug(repo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      }
      if (repo.defaultBranch) {
        setBranch(repo.defaultBranch);
      }

      // If repo name looks like compose stack, suggest compose
      if (repo.name.toLowerCase().includes('compose') && serviceType === 'app') {
        setServiceType('compose');
      }
    }
  };

  // Handle custom URL input
  const handleCustomUrlChange = (urlVal: string) => {
    setCustomGitUrl(urlVal);
    setUrlError('');

    // Try auto-extracting repository name from git URL
    const cleaned = urlVal.trim().replace(/\.git$/, '');
    const match = cleaned.match(/[/]([^/]+)$/);
    if (match && match[1] && !name) {
      const extractedName = match[1];
      setName(extractedName);
      if (!isSlugTouched) {
        setSlug(extractedName.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      }
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (nameError) setNameError('');
    if (!isSlugTouched) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'));
      if (slugError) setSlugError('');
    }
  };

  // Validate Step 1 before proceeding to Step 2
  const validateStep1 = (): boolean => {
    let valid = true;

    if (!name.trim()) {
      setNameError('Service name is required');
      valid = false;
    } else if (name.trim().length < 2) {
      setNameError('Service name must be at least 2 characters');
      valid = false;
    } else {
      setNameError('');
    }

    if (!slug.trim()) {
      setSlugError('Service slug is required');
      valid = false;
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setSlugError('Slug can only contain lowercase letters, numbers, and hyphens');
      valid = false;
    } else {
      setSlugError('');
    }

    if (sourceMode === 'account') {
      if (!selectedRepoId) {
        setRepoError('Please select a repository');
        valid = false;
      } else {
        setRepoError('');
      }
    } else {
      const trimmedUrl = customGitUrl.trim();
      if (!trimmedUrl) {
        setUrlError('Git repository URL is required');
        valid = false;
      } else if (!/^(https?:\/\/|git@|ssh:\/\/).+/.test(trimmedUrl)) {
        setUrlError('Please provide a valid Git URL (e.g. https://... or git@...)');
        valid = false;
      } else {
        setUrlError('');
      }
    }

    return valid;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateServiceInput) => createService(input),
    onSuccess: (newService) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['project-services', newService.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(
        `${serviceType === 'compose' ? 'Compose stack' : 'Application'} "${newService.name}" deployed successfully!`
      );
      onOpenChange(false);
      resetForm();
      if (onSuccess) {
        onSuccess(newService);
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create service');
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // STRICT GUARD: If user is on Step 1, ONLY advance to Step 2, NEVER deploy
    if (step === 1) {
      handleNextStep();
      return;
    }

    // On Step 2: Ensure step 1 data is valid
    if (!validateStep1()) {
      setStep(1);
      return;
    }

    if (!selectedNodeId) {
      setNodeError('Please select a target cluster node');
      return;
    } else {
      setNodeError('');
    }

    let repoUrl = customGitUrl.trim();
    if (sourceMode === 'account') {
      const foundRepo = syncedRepos.find((r) => r.id === selectedRepoId);
      repoUrl = foundRepo ? foundRepo.htmlUrl : '';
    }

    createMutation.mutate({
      projectId: resolvedProjectId,
      name: name.trim(),
      type: serviceType,
      nodeId: selectedNodeId,
      repository: repoUrl,
      branch: branch.trim() || 'main',
      dockerfile: serviceType === 'app' ? dockerfilePath.trim() : undefined,
      composeFile: serviceType === 'compose' ? composeFilePath.trim() : undefined,
      ports: serviceType === 'app' ? [parseInt(port, 10) || 80] : [80],
      publishToHost: serviceType === 'app' ? publishToHost : false,
      limits: {
        cpuCores,
        memoryMb,
      },
    });
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const maxCpu = selectedNode?.cpuTotalCores || 16;
  const maxMemoryMb = selectedNode?.memoryTotalMb || 32768;

  // Clamp resource limits when selected node changes
  useEffect(() => {
    if (selectedNode) {
      setCpuCores((prev) => (prev > selectedNode.cpuTotalCores ? selectedNode.cpuTotalCores : prev));
      setMemoryMb((prev) => (prev > selectedNode.memoryTotalMb ? selectedNode.memoryTotalMb : prev));
    }
  }, [selectedNodeId, selectedNode]);

  // Stepped milestones for CPU & Memory sliders
  const availableCpuSteps = useMemo(() => {
    const base = [0.5, 1, 2, 4, 8, 16];
    const filtered = base.filter((c) => c <= maxCpu);
    if (!filtered.includes(maxCpu) && maxCpu > 0) {
      filtered.push(maxCpu);
      filtered.sort((a, b) => a - b);
    }
    return filtered.length > 0 ? filtered : [0.5, 1, 2, 4];
  }, [maxCpu]);

  const availableMemorySteps = useMemo(() => {
    const base = [
      { mb: 512, label: '512M' },
      { mb: 1024, label: '1G' },
      { mb: 2048, label: '2G' },
      { mb: 4096, label: '4G' },
      { mb: 8192, label: '8G' },
      { mb: 16384, label: '16G' },
      { mb: 32768, label: '32G' },
    ];
    const filtered = base.filter((m) => m.mb <= maxMemoryMb);
    if (!filtered.some((m) => m.mb === maxMemoryMb) && maxMemoryMb >= 512) {
      const label =
        maxMemoryMb >= 1024
          ? `${Math.round(maxMemoryMb / 1024)}G`
          : `${maxMemoryMb}M`;
      filtered.push({ mb: maxMemoryMb, label });
      filtered.sort((a, b) => a.mb - b.mb);
    }
    return filtered.length > 0 ? filtered : base.slice(0, 4);
  }, [maxMemoryMb]);

  const memoryStepNumbers = useMemo(
    () => availableMemorySteps.map((m) => m.mb),
    [availableMemorySteps]
  );

  const cpuStepIndex = useMemo(
    () => getStepIndex(cpuCores, availableCpuSteps),
    [cpuCores, availableCpuSteps]
  );

  const memoryStepIndex = useMemo(
    () => getStepIndex(memoryMb, memoryStepNumbers),
    [memoryMb, memoryStepNumbers]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Strict No-Icon DialogHeader */}
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground font-sans">
            Create New Service
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Deploy an Application container or multi-container Compose stack to your cluster.
          </DialogDescription>
        </DialogHeader>

        {/* Wizard Stepper */}
        <div className="flex items-center gap-2 border-b border-border py-2.5">
          {/* Stepper Buttons */}
          <button
            type="button"
            onClick={() => setStep(1)}
            className={cn( 'flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-md transition-all cursor-pointer', step === 1 ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground' )}
          >
            <span
              className={cn( 'size-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors', step === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border' )}
            >
              1
            </span>
            <span>Service & Source</span>
          </button>

          <span className="text-muted-foreground/60 text-xs font-mono">/</span>

          <button
            type="button"
            onClick={() => {
              if (validateStep1()) setStep(2);
            }}
            className={cn( 'flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-md transition-all cursor-pointer', step === 2 ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground' )}
          >
            <span
              className={cn( 'size-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors', step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border' )}
            >
              2
            </span>
            <span>Node & Resources</span>
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 1) {
              handleNextStep();
            } else {
              handleSubmit(e);
            }
          }}
          className="space-y-5 pt-1"
        >
          {/* ================= STEP 1: SERVICE & SOURCE ================= */}
          {step === 1 && (
            <div className="space-y-5">
              {/* 1. Service Type Selector (Application vs Compose) */}
              <div className="space-y-2.5">
                <Label className="text-xs font-semibold text-foreground">
                  Select Service Type <span className="text-status-danger">*</span>
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Application Card */}
                  <button
                    type="button"
                    onClick={() => setServiceType('app')}
                    disabled={createMutation.isPending}
                    className={cn( 'relative flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer active:not-aria-[haspopup]:translate-y-px outline-none', serviceType === 'app' ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/40' : 'border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground' )}
                  >
                    <div
                      className={cn( 'size-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border', serviceType === 'app' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/60 border-border text-foreground' )}
                    >
                      <Layers className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">Application</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                            Single Container
                          </Badge>
                        </div>
                        {serviceType === 'app' && <Check className="size-3.5 text-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">
                        Web app, microservice, or API backend built from Dockerfile or source repository.
                      </p>
                    </div>
                  </button>

                  {/* Compose Card */}
                  <button
                    type="button"
                    onClick={() => setServiceType('compose')}
                    disabled={createMutation.isPending}
                    className={cn( 'relative flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer active:not-aria-[haspopup]:translate-y-px outline-none', serviceType === 'compose' ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/40' : 'border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground' )}
                  >
                    <div
                      className={cn( 'size-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border', serviceType === 'compose' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/60 border-border text-foreground' )}
                    >
                      <Boxes className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">Compose</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                            Multi-Container
                          </Badge>
                        </div>
                        {serviceType === 'compose' && <Check className="size-3.5 text-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">
                        Multi-service architecture orchestrating web, worker, and cache via docker-compose.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Git Source Selection */}
              <div className="rounded-xl border border-border bg-card/60 p-3.5 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="size-4 text-foreground" />
                    <span className="text-xs font-semibold text-foreground">Git Source Repository</span>
                  </div>

                  {/* Toggle Mode: Select Account/Repo vs Git URL */}
                  <div className="flex items-center p-0.5 rounded-lg border border-border bg-muted/30 text-xs">
                    <button
                      type="button"
                      onClick={() => setSourceMode('account')}
                      className={cn( 'px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer', sourceMode === 'account' ? 'bg-background text-foreground border border-border' : 'text-muted-foreground hover:text-foreground' )}
                    >
                      GitHub Account & Repo
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceMode('url')}
                      className={cn( 'px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer', sourceMode === 'url' ? 'bg-background text-foreground border border-border' : 'text-muted-foreground hover:text-foreground' )}
                    >
                      Custom Git URL
                    </button>
                  </div>
                </div>

                {/* Source Input Area (Exact 58px height in both modes) */}
                <div className="min-h-[58px]">
                  {sourceMode === 'account' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Select GitHub Account / Org */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">
                          GitHub Account / Organization
                        </Label>
                        <div>
                          <Select
                            value={selectedAccountId}
                            onValueChange={(val) => {
                              const accountId = String(val);
                              setSelectedAccountId(accountId);
                              setSelectedRepoId('');
                            }}
                          >
                            <SelectTrigger className="h-9 w-full bg-card border-border text-xs sm:text-sm">
                              <SelectValue placeholder="Select account..." />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border border-border">
                              {gitProviders.map((provider) => (
                                <SelectItem key={provider.id} value={provider.id} className="py-2">
                                  <div className="flex items-center gap-2">
                                    <GitHubIcon className="size-3.5 text-muted-foreground" />
                                    <span className="font-semibold text-xs text-foreground">
                                      {provider.username}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">
                                      ({provider.name})
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Select Repository */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">
                          Repository <span className="text-status-danger">*</span>
                        </Label>
                        <div>
                          <Select
                            value={selectedRepoId}
                            onValueChange={(val) => handleRepoChange(String(val))}
                          >
                            <SelectTrigger
                              className={cn( 'h-9 w-full bg-card border-border text-xs sm:text-sm', repoError && 'border-status-danger ring-1 ring-status-danger/40' )}
                            >
                              <SelectValue placeholder="Select repository..." />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border border-border max-h-56">
                              {accountRepos.length === 0 ? (
                                <div className="p-3 text-xs text-center text-muted-foreground">
                                  No repositories found for this account.
                                </div>
                              ) : (
                                accountRepos.map((repo) => (
                                  <SelectItem key={repo.id} value={repo.id} className="py-2">
                                    <div className="flex items-center justify-between w-full gap-2">
                                      <span className="font-mono text-xs font-medium text-foreground truncate">
                                        {repo.fullName}
                                      </span>
                                      {repo.private ? (
                                        <Lock className="size-3 text-muted-foreground shrink-0" />
                                      ) : (
                                        <Globe className="size-3 text-muted-foreground shrink-0" />
                                      )}
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        {repoError && (
                          <p className="text-xs font-medium text-status-danger mt-1">{repoError}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Custom Git URL */
                    <div className="space-y-1.5">
                      <Label htmlFor="custom-git-url" className="text-xs font-semibold text-foreground">
                        Git Repository URL <span className="text-status-danger">*</span>
                      </Label>
                      <div className="relative">
                        <FolderGit2 className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="custom-git-url"
                          value={customGitUrl}
                          onChange={(e) => handleCustomUrlChange(e.target.value)}
                          placeholder="https://github.com/organization/my-service.git"
                          aria-invalid={!!urlError}
                          className={cn('pl-8 h-9 text-xs sm:text-sm font-mono', urlError && 'border-status-danger')}
                        />
                      </div>
                      {urlError && (
                        <p className="text-xs font-medium text-status-danger mt-1">{urlError}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Git Branch (Shared & perfectly stationary in both modes) */}
                <div className="space-y-1.5">
                  <Label htmlFor="service-branch" className="text-xs font-semibold text-foreground">
                    Git Branch
                  </Label>
                  <div className="relative">
                    <GitBranch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="service-branch"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="e.g. main or master"
                      className="pl-8 h-9 text-xs sm:text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Service Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Service Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="service-name" className="text-xs font-semibold text-foreground">
                    Service Name <span className="text-status-danger">*</span>
                  </Label>
                  <Input
                    id="service-name"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder={serviceType === 'compose' ? 'e.g. backend-stack' : 'e.g. web-frontend'}
                    aria-invalid={!!nameError}
                    className="h-9 text-xs sm:text-sm"
                  />
                  {nameError && (
                    <p className="text-xs font-medium text-status-danger mt-1">{nameError}</p>
                  )}
                </div>

                {/* Service Slug */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="service-slug" className="text-xs font-semibold text-foreground">
                      Slug Identifier <span className="text-status-danger">*</span>
                    </Label>
                    <span className="text-[11px] text-muted-foreground font-mono">auto-generated</span>
                  </div>
                  <Input
                    id="service-slug"
                    value={slug}
                    onChange={(e) => {
                      setIsSlugTouched(true);
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      if (slugError) setSlugError('');
                    }}
                    placeholder="e.g. web-frontend"
                    aria-invalid={!!slugError}
                    className="h-9 text-xs sm:text-sm font-mono"
                  />
                  {slugError && (
                    <p className="text-xs font-medium text-status-danger mt-1">{slugError}</p>
                  )}
                </div>
              </div>

              {/* 4. Type Specific Settings (Flat Grid matching Service Identity) */}
              {serviceType === 'app' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Internal Container Port */}
                  <div className="space-y-1.5">
                    <Label htmlFor="app-port" className="text-xs font-semibold text-foreground">
                      Container Port
                    </Label>
                    <Input
                      id="app-port"
                      type="number"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      placeholder="3000"
                      className="h-9 text-xs sm:text-sm font-mono"
                    />
                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="checkbox"
                        id="publish-to-host"
                        checked={publishToHost}
                        onChange={(e) => setPublishToHost(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer"
                      />
                      <label htmlFor="publish-to-host" className="text-[11px] font-medium text-foreground cursor-pointer select-none">
                        Publish to Host IP (port {port || '3000'})
                      </label>
                    </div>
                  </div>

                  {/* Dockerfile Path */}
                  <div className="space-y-1.5">
                    <Label htmlFor="dockerfile-path" className="text-xs font-semibold text-foreground">
                      Dockerfile Path
                    </Label>
                    <Input
                      id="dockerfile-path"
                      value={dockerfilePath}
                      onChange={(e) => setDockerfilePath(e.target.value)}
                      placeholder="Dockerfile"
                      className="h-9 text-xs sm:text-sm font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Relative path to Dockerfile in repository root.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="compose-file-path" className="text-xs font-semibold text-foreground">
                    Compose File Path
                  </Label>
                  <Input
                    id="compose-file-path"
                    value={composeFilePath}
                    onChange={(e) => setComposeFilePath(e.target.value)}
                    placeholder="docker-compose.yml"
                    className="h-9 text-xs sm:text-sm font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Relative path to compose specification file (e.g. <code>docker-compose.yml</code> or <code>compose.yaml</code>).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 2: NODE & RESOURCES ================= */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Select Node as Cards */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold text-foreground">
                      Select Cluster Node <span className="text-status-danger">*</span>
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Select an online cluster worker node to host and execute this container service.
                    </p>
                  </div>
                  {nodes.length > 0 && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {nodes.length} {nodes.length === 1 ? 'Node' : 'Nodes'} Available
                    </Badge>
                  )}
                </div>

                {nodeError && (
                  <p className="text-xs font-medium text-status-danger">{nodeError}</p>
                )}

                {/* Node Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {nodes.map((node: Node) => {
                    const isSelected = selectedNodeId === node.id;
                    const isOffline = node.status === 'offline';
                    const isDegraded = node.status === 'degraded';

                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => {
                          setSelectedNodeId(node.id);
                          setNodeError('');
                        }}
                        disabled={isOffline || createMutation.isPending}
                        className={cn( 'relative flex flex-col p-3.5 rounded-xl border text-left transition-all cursor-pointer active:not-aria-[haspopup]:translate-y-px outline-none', isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground', isOffline && 'opacity-60 cursor-not-allowed bg-muted/20 hover:bg-muted/20' )}
                      >
                        {/* Header Row: Radio Indicator + Node Name + Status Badge */}
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Radio Circle */}
                            <div
                              className={cn( 'size-4 rounded-full border flex items-center justify-center shrink-0 transition-colors', isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background' )}
                            >
                              {isSelected && <div className="size-1.5 rounded-full bg-white" />}
                            </div>

                            <div className="min-w-0">
                              <span className="font-mono text-xs font-semibold text-foreground truncate block">
                                {node.name}
                              </span>
                            </div>
                          </div>

                          {/* Status Pill */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={cn( 'size-2 rounded-full', node.status === 'online' ? 'bg-status-success' : isDegraded ? 'bg-status-warning' : 'bg-status-danger' )}
                            />
                            <span className="text-[10px] font-medium capitalize text-muted-foreground">
                              {node.status}
                            </span>
                          </div>
                        </div>

                        {/* Specs & Hardware Row */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                          <span className="bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                            {node.cpuTotalCores} vCPU
                          </span>
                          <span className="bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                            {Math.round(node.memoryTotalMb / 1024)} GB RAM
                          </span>
                          <span className="bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                            {node.ipAddress}
                          </span>
                        </div>

                        {/* Usage & Telemetry Stats */}
                        <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Activity className="size-3 text-primary" />
                            <span>Load:</span>
                            <span className="font-mono font-medium text-foreground">
                              {node.usage.cpuPercent}% CPU
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono uppercase">
                            {node.role || 'worker'}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resource Allocation Quota - Option C: Hybrid Slider & Quick Presets */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="size-3 text-primary" />
                    Resource Quota & Limits
                  </span>
                  {selectedNode && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Node Capacity: {maxCpu} vCPU • {Math.round(maxMemoryMb / 1024)} GB
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* CPU Slider Card */}
                  <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Cpu className="size-3.5" />
                        </div>
                        <div>
                          <Label htmlFor="cpu-custom-input" className="text-xs font-semibold text-foreground block cursor-pointer">
                            CPU Limit
                          </Label>
                          <span className="text-[10px] text-muted-foreground">vCPU Cores quota</span>
                        </div>
                      </div>

                      {/* Custom Input */}
                      <div className="flex items-center gap-1.5">
                        <Input
                          id="cpu-custom-input"
                          type="number"
                          min="0.25"
                          max={maxCpu}
                          step="0.25"
                          value={cpuCores}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) {
                              setCpuCores(Math.min(maxCpu, Math.max(0.25, val)));
                            }
                          }}
                          className="w-20 h-7.5 text-xs font-mono text-right py-1 px-2"
                        />
                        <span className="text-xs font-mono text-muted-foreground">vCPU</span>
                      </div>
                    </div>

                    {/* Stepped Slider with Clickable Tick Marks */}
                    <div className="px-2 pt-2 pb-5">
                      <div className="relative">
                        <Slider
                          value={[cpuStepIndex]}
                          min={0}
                          max={availableCpuSteps.length - 1}
                          step={1}
                          thumbAlignment="center"
                          onValueChange={(val) => {
                            const arr = Array.isArray(val) ? val : [val];
                            const idx = arr[0];
                            if (idx !== undefined) {
                              const rounded = Math.round(idx);
                              if (availableCpuSteps[rounded] !== undefined) {
                                setCpuCores(availableCpuSteps[rounded]);
                              }
                            }
                          }}
                          className="py-1 cursor-pointer"
                        />

                        {/* Clickable Step Marks & Labels */}
                        <div className="relative w-full h-7 mt-1.5 pointer-events-none select-none">
                          {availableCpuSteps.map((stepVal, idx) => {
                            const totalSteps = availableCpuSteps.length > 1 ? availableCpuSteps.length - 1 : 1;
                            const percent = (idx / totalSteps) * 100;
                            const isSelected = cpuCores === stepVal;
                            const isPast = cpuCores >= stepVal;

                            return (
                              <button
                                key={stepVal}
                                type="button"
                                onClick={() => setCpuCores(stepVal)}
                                title={`Set CPU to ${stepVal} vCPU`}
                                className="pointer-events-auto absolute -translate-x-1/2 flex flex-col items-center group cursor-pointer focus:outline-none"
                                style={{ left: `${percent}%` }}
                              >
                                {/* Tick notch */}
                                <span
                                  className={cn("w-0.5 rounded-full transition-all mb-1",
                                    isSelected
                                      ? "bg-primary h-2 w-1"
                                      : isPast
                                      ? "bg-primary/70 h-1.5"
                                      : "bg-muted-foreground/30 h-1.5",
                                    "group-hover:bg-primary group-hover:h-2 group-hover:w-1"
                                  )}
                                />
                                {/* Step label */}
                                <span
                                  className={cn("text-[10px] font-mono leading-none transition-colors px-1 py-0.5 rounded",
                                    isSelected
                                      ? "text-primary font-bold bg-primary/10"
                                      : "text-muted-foreground group-hover:text-foreground group-hover:bg-muted/60"
                                  )}
                                >
                                  {stepVal}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Memory Slider Card */}
                  <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <HardDrive className="size-3.5" />
                        </div>
                        <div>
                          <Label htmlFor="memory-custom-input" className="text-xs font-semibold text-foreground block cursor-pointer">
                            Memory Limit
                          </Label>
                          <span className="text-[10px] text-muted-foreground">RAM allocation</span>
                        </div>
                      </div>

                      {/* Custom Input */}
                      <div className="flex items-center gap-1.5">
                        <Input
                          id="memory-custom-input"
                          type="number"
                          min="128"
                          max={maxMemoryMb}
                          step="128"
                          value={memoryMb}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val > 0) {
                              setMemoryMb(Math.min(maxMemoryMb, Math.max(128, val)));
                            }
                          }}
                          className="w-24 h-7.5 text-xs font-mono text-right py-1 px-2"
                        />
                        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                          MB {memoryMb >= 1024 ? `(${(memoryMb / 1024).toFixed(memoryMb % 1024 === 0 ? 0 : 1)}G)` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Stepped Slider with Clickable Tick Marks */}
                    <div className="px-2 pt-2 pb-5">
                      <div className="relative">
                        <Slider
                          value={[memoryStepIndex]}
                          min={0}
                          max={availableMemorySteps.length - 1}
                          step={1}
                          thumbAlignment="center"
                          onValueChange={(val) => {
                            const arr = Array.isArray(val) ? val : [val];
                            const idx = arr[0];
                            if (idx !== undefined) {
                              const rounded = Math.round(idx);
                              if (availableMemorySteps[rounded] !== undefined) {
                                setMemoryMb(availableMemorySteps[rounded].mb);
                              }
                            }
                          }}
                          className="py-1 cursor-pointer"
                        />

                        {/* Clickable Step Marks & Labels */}
                        <div className="relative w-full h-7 mt-1.5 pointer-events-none select-none">
                          {availableMemorySteps.map((stepItem, idx) => {
                            const totalSteps = availableMemorySteps.length > 1 ? availableMemorySteps.length - 1 : 1;
                            const percent = (idx / totalSteps) * 100;
                            const isSelected = memoryMb === stepItem.mb;
                            const isPast = memoryMb >= stepItem.mb;

                            return (
                              <button
                                key={stepItem.mb}
                                type="button"
                                onClick={() => setMemoryMb(stepItem.mb)}
                                title={`Set Memory to ${stepItem.label} (${stepItem.mb} MB)`}
                                className="pointer-events-auto absolute -translate-x-1/2 flex flex-col items-center group cursor-pointer focus:outline-none"
                                style={{ left: `${percent}%` }}
                              >
                                {/* Tick notch */}
                                <span
                                  className={cn("w-0.5 rounded-full transition-all mb-1",
                                    isSelected
                                      ? "bg-primary h-2 w-1"
                                      : isPast
                                      ? "bg-primary/70 h-1.5"
                                      : "bg-muted-foreground/30 h-1.5",
                                    "group-hover:bg-primary group-hover:h-2 group-hover:w-1"
                                  )}
                                />
                                {/* Step label */}
                                <span
                                  className={cn("text-[10px] font-mono leading-none transition-colors px-1 py-0.5 rounded",
                                    isSelected
                                      ? "text-primary font-bold bg-primary/10"
                                      : "text-muted-foreground group-hover:text-foreground group-hover:bg-muted/60"
                                  )}
                                >
                                  {stepItem.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Deployment Confirmation Summary */}
              <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2 text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <CheckCircle2 className="size-3 text-status-success" />
                  Deployment Summary
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-1 text-xs">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Service Name</span>
                    <span className="font-semibold text-foreground truncate block">{name}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Type</span>
                    <span className="font-mono text-foreground capitalize">{serviceType}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Target Node</span>
                    <span className="font-mono text-foreground truncate block">
                      {selectedNode?.name || 'Auto'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Project</span>
                    <span className="font-semibold text-foreground truncate block">
                      {currentProject?.name || 'Default'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dialog Footer with Wizard Navigation */}
          <DialogFooter className="pt-3.5 border-t border-border flex items-center justify-between gap-3">
            {step === 1 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="text-xs sm:text-sm h-9 cursor-pointer active:not-aria-[haspopup]:translate-y-px"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleNextStep();
                  }}
                  className="text-xs sm:text-sm h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer active:not-aria-[haspopup]:translate-y-px gap-1.5"
                >
                  <span>Next: Node & Resources</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={createMutation.isPending}
                  className="text-xs sm:text-sm h-9 cursor-pointer active:not-aria-[haspopup]:translate-y-px gap-1.5"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Back to Service</span>
                </Button>

                <Button
                  type="submit"
                  disabled={createMutation.isPending || !selectedNodeId}
                  className="text-xs sm:text-sm h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer active:not-aria-[haspopup]:translate-y-px gap-1.5"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Deploying Service...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      <span>Deploy {serviceType === 'compose' ? 'Compose Stack' : 'Application'}</span>
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
