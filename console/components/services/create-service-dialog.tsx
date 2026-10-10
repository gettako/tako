'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { FieldError } from '@/components/ui/field';
import { parseApiError } from '@/lib/form-errors';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select';
import {
  GitBranch,
  Globe,
  Plus,
  Loader2,
  Check,
  Server,
  FolderGit2,
  Cpu,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Building2,
  User,
  Database,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  useProjects,
  useNodes,
  useGitProviders,
  useSyncedRepos,
  useGitHubAppConfig,
  useCreateService,
} from '@/lib/queries';
import { Service, ServiceType, CreateServiceInput, Node } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ResourceSliderFields } from './wizard/resource-slider-fields';
import { NodePlacementPicker } from './wizard/node-placement-picker';

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

export const DATABASE_PRESETS = [
  {
    type: 'postgresql' as const,
    name: 'PostgreSQL',
    port: 5432,
    defaultTag: 'latest',
    tags: ['latest', '16-alpine', '15-alpine'],
    desc: 'Relational database with JSON support & ACID transactions.',
  },
  {
    type: 'mysql' as const,
    name: 'MySQL',
    port: 3306,
    defaultTag: 'latest',
    tags: ['latest', '8.0', '8.4'],
    desc: 'Fast, widely adopted relational SQL database.',
  },
  {
    type: 'redis' as const,
    name: 'Redis',
    port: 6379,
    defaultTag: 'latest',
    tags: ['latest', '7-alpine', '6-alpine'],
    desc: 'Ultra-fast in-memory key-value cache and message broker.',
  },
  {
    type: 'mongodb' as const,
    name: 'MongoDB',
    port: 27017,
    defaultTag: 'latest',
    tags: ['latest', '7.0', '6.0'],
    desc: 'Document-oriented NoSQL database with flexible JSON documents.',
  },
];

export interface CreateServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  initialServiceType?: ServiceType;
  onSuccess?: (service: Service) => void;
}

export function CreateServiceDialog({
  open,
  onOpenChange,
  projectId: initialProjectId,
  initialServiceType = 'app',
  onSuccess,
}: CreateServiceDialogProps) {
  // Wizard Step: 1 = Service & Source, 2 = Node & Resources
  const [step, setStep] = useState<1 | 2>(1);

  // Queries
  const { data: projects = [] } = useProjects({ enabled: open });
  const { data: nodes = [] } = useNodes({ enabled: open });
  const { data: githubApp } = useGitHubAppConfig({ enabled: open });
  const { data: gitProviders = [] } = useGitProviders({ enabled: open });
  const { data: syncedRepos = [] } = useSyncedRepos({ enabled: open });

  // Automatically determine project from props or fallback
  const resolvedProjectId = initialProjectId || projects[0]?.id || '';
  const currentProject = projects.find((p) => p.id === resolvedProjectId) || projects[0];

  // Form State - Step 1
  const [serviceType, setServiceType] = useState<ServiceType>(initialServiceType);
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

  // Database specific config
  const [databaseType, setDatabaseType] = useState<'postgresql' | 'mysql' | 'redis' | 'mongodb'>('postgresql');
  const [databaseVersion, setDatabaseVersion] = useState<string>('latest');

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

  // Derived unique accounts/organizations from githubApp, gitProviders, and synced repos
  const availableAccounts = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; username: string; type: string; avatarUrl?: string; repoCount: number }
    >();

    // 1. Primary: Seed from all GitHub App installations (Multi-Org source of truth)
    if (githubApp?.installations && githubApp.installations.length > 0) {
      githubApp.installations.forEach((inst) => {
        if (!inst.account?.login) return;
        const key = inst.account.login.toLowerCase();
        map.set(key, {
          id: inst.account.login,
          name: inst.account.login,
          username: inst.account.login,
          type: inst.account.type === 'Organization' ? 'Organization' : 'Personal',
          avatarUrl: inst.account.avatarUrl,
          repoCount: 0,
        });
      });
    } else if (githubApp?.owner?.login) {
      const key = githubApp.owner.login.toLowerCase();
      map.set(key, {
        id: githubApp.owner.login,
        name: githubApp.owner.login,
        username: githubApp.owner.login,
        type: githubApp.owner.type === 'Organization' ? 'Organization' : 'Personal',
        avatarUrl: githubApp.owner.avatarUrl,
        repoCount: 0,
      });
    }

    // 2. Secondary: Seed from gitProviders
    gitProviders.forEach((p) => {
      if (!p.username) return;
      const key = p.username.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: p.username,
          name: p.name || p.username,
          username: p.username,
          type: 'Personal',
          avatarUrl: p.avatarUrl,
          repoCount: 0,
        });
      }
    });

    // 3. Count & discover repos from synced repos
    syncedRepos.forEach((r) => {
      const acct = r.account || (r.fullName ? r.fullName.split('/')[0] : '');
      if (!acct) return;
      const key = acct.toLowerCase();
      const existing = map.get(key);
      const isOrg = r.accountType === 'Organization';
      if (existing) {
        existing.repoCount += 1;
        if (isOrg) existing.type = 'Organization';
      } else {
        map.set(key, {
          id: acct,
          name: acct,
          username: acct,
          type: isOrg ? 'Organization' : 'Personal',
          repoCount: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.username.localeCompare(b.username));
  }, [githubApp, gitProviders, syncedRepos]);

  // Initial defaults on open
  useEffect(() => {
    if (open) {
      setServiceType(initialServiceType);
      if (initialServiceType === 'database') {
        setName((prev) => (prev && !prev.endsWith('-db') ? prev : 'postgresql-db'));
        setSlug((prev) => (prev && !prev.endsWith('-db') ? prev : 'postgresql-db'));
      }
      if (
        availableAccounts.length > 0 &&
        (!selectedAccountId || !availableAccounts.some((a) => a.id.toLowerCase() === selectedAccountId.toLowerCase()))
      ) {
        if (availableAccounts.length > 1) {
          setSelectedAccountId('all');
        } else {
          setSelectedAccountId(availableAccounts[0].id);
        }
      }

      if (nodes.length > 0 && !selectedNodeId) {
        // Prefer first online worker node, or fallback to any available node
        const defaultWorker = nodes.find((n) => n.role === 'worker' && n.status === 'online') || nodes[0];
        if (defaultWorker) {
          setSelectedNodeId(defaultWorker.id);
        }
      }
    }
  }, [open, initialServiceType, availableAccounts, nodes, selectedAccountId, selectedNodeId]);

  // Filter and sort repositories based on selected account (latest activity first)
  const accountRepos = useMemo(() => {
    const list = syncedRepos.filter((repo) => {
      if (!selectedAccountId || selectedAccountId === 'all') return true;
      const repoAccount = repo.account || (repo.fullName ? repo.fullName.split('/')[0] : '');
      return (
        repoAccount.toLowerCase() === selectedAccountId.toLowerCase() ||
        repo.providerId.toLowerCase() === selectedAccountId.toLowerCase() ||
        repo.providerId.toLowerCase() === `git-gh-${selectedAccountId.toLowerCase()}`
      );
    });

    // Sort by latest activity (updatedAt descending)
    return list.sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [syncedRepos, selectedAccountId]);

  // Options for Account Select (search automatically enabled if > 5)
  const accountOptions: SearchableSelectOption[] = useMemo(() => {
    const opts: SearchableSelectOption[] = [];
    if (availableAccounts.length > 1) {
      opts.push({
        value: 'all',
        label: 'All Organizations & Accounts',
        description: `${syncedRepos.length} repositories across all accounts`,
        icon: Globe,
      });
    }
    availableAccounts.forEach((acc) => {
      opts.push({
        value: acc.id,
        label: acc.username,
        description: `${acc.repoCount} ${acc.repoCount === 1 ? 'repository' : 'repositories'} synced`,
        avatarUrl: acc.avatarUrl,
        icon: acc.type === 'Organization' ? Building2 : User,
        badge: (
          <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal text-muted-foreground">
            {acc.type}
          </Badge>
        ),
      });
    });
    return opts;
  }, [availableAccounts, syncedRepos.length]);

  // Options for Repository Select (sorted by latest activity, search automatically enabled if > 5)
  const repoOptions: SearchableSelectOption[] = useMemo(() => {
    return accountRepos.map((repo) => ({
      value: repo.id,
      label: repo.fullName,
      icon: GitHubIcon,
    }));
  }, [accountRepos]);

  // Keep selectedRepoId synchronized: if the currently selected repo is not in accountRepos, reset it cleanly
  useEffect(() => {
    if (selectedRepoId && !accountRepos.some((r) => r.id === selectedRepoId)) {
      setSelectedRepoId('');
    }
  }, [accountRepos, selectedRepoId]);

  const resetForm = () => {
    setStep(1);
    setServiceType(initialServiceType);
    setSourceMode('account');
    setSelectedRepoId('');
    setCustomGitUrl('');
    setBranch('main');
    setName(initialServiceType === 'database' ? 'postgresql-db' : '');
    setSlug(initialServiceType === 'database' ? 'postgresql-db' : '');
    setIsSlugTouched(false);
    setPort('3000');
    setPublishToHost(true);
    setDockerfilePath('Dockerfile');
    setComposeFilePath('docker-compose.yml');
    setDatabaseType('postgresql');
    setDatabaseVersion('latest');
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
  const handleRepoChange = (repoId: string | null | undefined) => {
    if (!repoId || repoId === 'null' || repoId === 'undefined') {
      setSelectedRepoId('');
      return;
    }
    setSelectedRepoId(repoId);
    setRepoError('');
    const repo = syncedRepos.find((r) => r.id === repoId);
    if (repo) {
      if (!name || !isSlugTouched) {
        setName(repo.name);
      }
      if (!isSlugTouched) {
        setSlug(repo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      }
      if (repo.defaultBranch) {
        setBranch(repo.defaultBranch);
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

    if (serviceType === 'database') {
      if (!databaseVersion.trim()) {
        setDatabaseVersion('latest');
      }
      return valid;
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

  const createMutation = useCreateService({
    onSuccess: (newService) => {
      toast.success(
        `${serviceType === 'database' ? 'Database instance' : serviceType === 'compose' ? 'Compose stack' : 'Application'} "${newService.name}" deployed successfully!`
      );
      onOpenChange(false);
      resetForm();
      if (onSuccess) {
        onSuccess(newService);
      }
    },
    onError: (err) => {
      const parsed = parseApiError(err);
      if (parsed.is422) {
        let hasStep1Error = false;
        if (parsed.fieldErrors.name) {
          setNameError(parsed.fieldErrors.name);
          hasStep1Error = true;
        }
        if (parsed.fieldErrors.slug) {
          setSlugError(parsed.fieldErrors.slug);
          hasStep1Error = true;
        }
        if (parsed.fieldErrors.repository || parsed.fieldErrors.customGitUrl || parsed.fieldErrors.url) {
          setUrlError(parsed.fieldErrors.repository || parsed.fieldErrors.customGitUrl || parsed.fieldErrors.url);
          hasStep1Error = true;
        }
        if (parsed.fieldErrors.repoId || parsed.fieldErrors.repositoryId) {
          setRepoError(parsed.fieldErrors.repoId || parsed.fieldErrors.repositoryId);
          hasStep1Error = true;
        }
        if (parsed.fieldErrors.nodeId || parsed.fieldErrors.node) {
          setNodeError(parsed.fieldErrors.nodeId || parsed.fieldErrors.node);
        }
        if (hasStep1Error) {
          setStep(1);
        }
        toast.error(parsed.message || 'Validation failed. Please check the marked fields.');
      } else {
        toast.error(parsed.message || 'Failed to create service');
      }
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

    const dbPreset = DATABASE_PRESETS.find((p) => p.type === databaseType);
    const dbPort = dbPreset ? dbPreset.port : 5432;

    createMutation.mutate({
      projectId: resolvedProjectId,
      name: name.trim(),
      slug: slug.trim(),
      type: serviceType,
      nodeId: selectedNodeId,
      repository: serviceType === 'database' ? '' : repoUrl,
      branch: serviceType === 'database' ? 'main' : (branch.trim() || 'main'),
      dockerfile: serviceType === 'app' ? dockerfilePath.trim() : undefined,
      composeFile: serviceType === 'compose' ? composeFilePath.trim() : undefined,
      databaseType: serviceType === 'database' ? databaseType : undefined,
      databaseVersion: serviceType === 'database' ? (databaseVersion.trim() || 'latest') : undefined,
      ports: serviceType === 'database' ? [dbPort] : serviceType === 'app' ? [parseInt(port, 10) || 80] : [80],
      publishToHost: serviceType === 'database' ? true : (serviceType === 'app' ? publishToHost : false),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Strict No-Icon DialogHeader */}
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground font-sans">
            {serviceType === 'database'
              ? 'Create Database'
              : serviceType === 'compose'
              ? 'Deploy Compose Stack'
              : 'Create Application'}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {serviceType === 'database'
              ? 'Deploy a dedicated database instance with persistent volume storage to your cluster.'
              : serviceType === 'compose'
              ? 'Deploy a multi-container workload defined by a docker-compose specification.'
              : 'Deploy a single container web application or backend service to your cluster.'}
          </DialogDescription>
        </DialogHeader>

        {/* Wizard Stepper */}
        <div className="grid grid-cols-2 gap-4 pb-3 border-b border-border">
          {/* Step 1 */}
          <button
            type="button"
            onClick={() => setStep(1)}
            className="group flex flex-col gap-1.5 text-left cursor-pointer outline-none active:not-aria-[haspopup]:translate-y-px"
          >
            <div className="flex items-center justify-between text-xs">
              <span
                className={cn(
                  'font-semibold transition-colors flex items-center gap-2',
                  step === 1 ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'size-5 rounded-full flex items-center justify-center text-[11px] font-bold font-mono transition-colors',
                    step === 1
                      ? 'bg-primary text-primary-foreground'
                      : step > 1
                      ? 'bg-status-success/20 text-status-success'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {step > 1 ? <Check className="size-3 stroke-[2.5]" /> : '1'}
                </span>
                <span>Service & Source</span>
              </span>
              <span
                className={cn(
                  'text-[11px] font-mono transition-colors',
                  step === 1 ? 'text-primary font-medium' : 'text-status-success font-medium'
                )}
              >
                {step === 1 ? 'In progress' : 'Completed'}
              </span>
            </div>
            <div
              className={cn(
                'h-1 rounded-full transition-all duration-200',
                step === 1 ? 'bg-primary' : 'bg-status-success/70'
              )}
            />
          </button>

          {/* Step 2 */}
          <button
            type="button"
            onClick={() => {
              if (validateStep1()) setStep(2);
            }}
            className="group flex flex-col gap-1.5 text-left cursor-pointer outline-none active:not-aria-[haspopup]:translate-y-px"
          >
            <div className="flex items-center justify-between text-xs">
              <span
                className={cn(
                  'font-semibold transition-colors flex items-center gap-2',
                  step === 2 ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'size-5 rounded-full flex items-center justify-center text-[11px] font-bold font-mono transition-colors',
                    step === 2
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  2
                </span>
                <span>Node & Resources</span>
              </span>
              <span
                className={cn(
                  'text-[11px] font-mono transition-colors',
                  step === 2 ? 'text-primary font-medium' : 'text-muted-foreground/60'
                )}
              >
                {step === 2 ? 'In progress' : 'Next step'}
              </span>
            </div>
            <div
              className={cn(
                'h-1 rounded-full transition-all duration-200',
                step === 2 ? 'bg-primary' : 'bg-muted'
              )}
            />
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
              {/* Database Engine & Tag OR Git Source Selection */}
              {serviceType === 'database' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Database className="size-3.5 text-foreground" />
                      <span>Database Engine &amp; Tag</span>
                      <span className="text-status-danger">*</span>
                    </Label>
                    <Badge variant="secondary" className="text-[11px] font-mono">
                      Persistent Docker Volume
                    </Badge>
                  </div>

                  {/* 4 DB Engines Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {DATABASE_PRESETS.map((p) => {
                      const isSelected = databaseType === p.type;
                      return (
                        <button
                          key={p.type}
                          type="button"
                          onClick={() => {
                            setDatabaseType(p.type);
                            if (!isSlugTouched || name.endsWith('-db')) {
                              setName(`${p.type}-db`);
                              setSlug(`${p.type}-db`);
                            }
                          }}
                          className={cn(
                            'flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer outline-none active:not-aria-[haspopup]:translate-y-px',
                            isSelected
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/40 text-foreground'
                              : 'border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold text-foreground">{p.name}</span>
                            {isSelected && <Check className="size-3 text-primary" />}
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground mt-1">Port {p.port}</span>
                          <span className="text-[10px] text-muted-foreground/80 mt-1 line-clamp-1">{p.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Image Tag / Version Input Field (Default 'latest', editable by user) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="db-image-tag" className="text-xs font-semibold text-foreground">
                        Image Tag / Version <span className="text-status-danger">*</span>
                      </Label>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Target Image: {databaseType === 'mongodb' ? 'mongo' : databaseType}:{databaseVersion || 'latest'}
                      </span>
                    </div>
                    <Input
                      id="db-image-tag"
                      value={databaseVersion}
                      onChange={(e) => setDatabaseVersion(e.target.value)}
                      placeholder="latest"
                      className="h-9 text-xs sm:text-sm font-mono"
                    />
                    <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">Version Presets:</span>
                      {(DATABASE_PRESETS.find((p) => p.type === databaseType)?.tags || ['latest']).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setDatabaseVersion(tag)}
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer font-mono active:not-aria-[haspopup]:translate-y-px',
                            databaseVersion === tag
                              ? 'bg-primary text-primary-foreground border-primary font-semibold'
                              : 'bg-muted/50 text-muted-foreground border-border hover:text-foreground'
                          )}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FolderGit2 className="size-3.5 text-foreground" />
                      <span>Git Source Repository</span>
                      <span className="text-status-danger">*</span>
                    </Label>

                    {/* Toggle Mode: Select Account/Repo vs Git URL */}
                    <div className="flex items-center p-0.5 rounded-lg border border-border bg-muted/40 text-xs">
                      <button
                        type="button"
                        onClick={() => setSourceMode('account')}
                        className={cn(
                          'px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer text-xs active:not-aria-[haspopup]:translate-y-px',
                          sourceMode === 'account'
                            ? 'bg-background text-foreground shadow-xs border border-border/80'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        GitHub Account &amp; Repo
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceMode('url')}
                        className={cn(
                          'px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer text-xs active:not-aria-[haspopup]:translate-y-px',
                          sourceMode === 'url'
                            ? 'bg-background text-foreground shadow-xs border border-border/80'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        Custom Git URL
                      </button>
                    </div>
                  </div>

                  {/* Source Input Area */}
                  <div>
                    {sourceMode === 'account' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Select GitHub Account / Org */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">
                            GitHub Account / Organization
                          </Label>
                          <div>
                            <SearchableSelect
                              options={accountOptions}
                              value={selectedAccountId || undefined}
                              onValueChange={(val) => {
                                if (!val || val === 'null' || val === 'undefined') return;
                                const accountId = String(val);
                                setSelectedAccountId(accountId);
                                setSelectedRepoId('');
                                setRepoError('');
                                if (!isSlugTouched) {
                                  setName('');
                                  setSlug('');
                                }
                              }}
                              placeholder="Select account or organization..."
                              searchPlaceholder="Search account or organization..."
                              className="w-full"
                              renderTrigger={(opt) => {
                                if (!opt) {
                                  return (
                                    <span className="text-muted-foreground font-normal">
                                      Select account or organization...
                                    </span>
                                  );
                                }
                                if (opt.value === 'all') {
                                  return (
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Globe className="size-3.5 text-primary shrink-0" />
                                      <span className="font-semibold text-xs text-foreground truncate">
                                        All Organizations &amp; Accounts
                                      </span>
                                    </div>
                                  );
                                }
                                const acc = availableAccounts.find((a) => a.id === opt.value);
                                return (
                                  <div className="flex items-center gap-2 min-w-0">
                                    {acc?.avatarUrl ? (
                                      <Avatar className="size-4 shrink-0">
                                        <AvatarImage src={acc.avatarUrl} />
                                        <AvatarFallback className="text-[9px]">
                                          {acc.username.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    ) : acc?.type === 'Organization' ? (
                                      <Building2 className="size-3.5 text-blue-500 shrink-0" />
                                    ) : (
                                      <User className="size-3.5 text-muted-foreground shrink-0" />
                                    )}
                                    <span className="font-semibold text-xs text-foreground truncate">
                                      {acc?.username || opt.label}
                                    </span>
                                    {acc?.type && (
                                      <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal text-muted-foreground shrink-0">
                                        {acc.type}
                                      </Badge>
                                    )}
                                  </div>
                                );
                              }}
                            />
                          </div>
                        </div>

                        {/* Select Repository */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-foreground">
                            Repository <span className="text-status-danger">*</span>
                          </Label>
                          <div>
                            <SearchableSelect
                              options={repoOptions}
                              value={selectedRepoId || undefined}
                              onValueChange={(val) => {
                                if (!val || val === 'null' || val === 'undefined') {
                                  handleRepoChange('');
                                } else {
                                  handleRepoChange(String(val));
                                }
                              }}
                              placeholder="Select repository..."
                              searchPlaceholder="Search repository..."
                              emptyText={
                                accountRepos.length === 0
                                  ? 'No repositories found for this account.'
                                  : 'No matching repositories found.'
                              }
                              error={repoError}
                              className="w-full"
                              renderTrigger={(opt) => {
                                if (!opt) {
                                  return (
                                    <span className="text-muted-foreground font-normal">
                                      Select repository...
                                    </span>
                                  );
                                }
                                const repo = syncedRepos.find((r) => r.id === opt.value);
                                return (
                                  <div className="flex items-center gap-2 min-w-0">
                                    <GitHubIcon className="size-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-mono text-xs font-medium text-foreground truncate">
                                      {repo ? repo.fullName : opt.label}
                                    </span>
                                  </div>
                                );
                              }}
                            />
                          </div>
                          <FieldError error={repoError} />
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
                            error={!!urlError}
                            className="pl-8 h-9 text-xs sm:text-sm font-mono"
                          />
                        </div>
                        <FieldError error={urlError} />
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
              )}

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
                    error={!!nameError}
                    className="h-9 text-xs sm:text-sm"
                  />
                  <FieldError error={nameError} />
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
                    error={!!slugError}
                    className="h-9 text-xs sm:text-sm font-mono"
                  />
                  <FieldError error={slugError} />
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
              ) : serviceType === 'compose' ? (
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
              ) : (
                <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Persistent Storage:</span>
                    <span className="font-mono text-foreground font-medium">tako-data-{slug || 'db'}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Default User:</span>
                    <span className="font-mono text-foreground font-medium">tako</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Credentials & Connection URI:</span>
                    <span className="text-[11px] text-primary font-medium">Auto-generated & encrypted on deployment</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 2: NODE & RESOURCES ================= */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Select Node as Cards */}
              <NodePlacementPicker
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={(id) => {
                  setSelectedNodeId(id);
                  setNodeError('');
                }}
                disabled={createMutation.isPending}
                nodeError={nodeError}
              />

              {/* Resource Allocation Quota */}
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

                <ResourceSliderFields
                  cpuCores={cpuCores}
                  setCpuCores={setCpuCores}
                  memoryMb={memoryMb}
                  setMemoryMb={setMemoryMb}
                  maxCpu={maxCpu}
                  maxMemoryMb={maxMemoryMb}
                  disabled={createMutation.isPending}
                />
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
                  className="text-sm h-9 cursor-pointer active:not-aria-[haspopup]:translate-y-px"
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
                  className="text-sm h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer active:not-aria-[haspopup]:translate-y-px gap-1.5"
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
                  className="text-sm h-9 cursor-pointer active:not-aria-[haspopup]:translate-y-px gap-1.5"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Back to Service</span>
                </Button>

                <Button
                  type="submit"
                  disabled={createMutation.isPending || !selectedNodeId}
                  className="text-sm h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer active:not-aria-[haspopup]:translate-y-px gap-1.5"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Deploying Service...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      <span>
                        Deploy{' '}
                        {serviceType === 'database'
                          ? 'Database'
                          : serviceType === 'compose'
                          ? 'Compose Stack'
                          : 'Application'}
                      </span>
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
