import { Deployment, DeploymentStep, DeploymentStatus } from '@/lib/types';

function generatePreviewUrl(commitHash?: string, depId?: string): string {
  let commit8 = (commitHash || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (commit8.length >= 8) {
    commit8 = commit8.slice(0, 8);
  } else if (commit8 && commit8 !== 'main') {
    commit8 = (commit8 + '00000000').slice(0, 8);
  } else {
    const cleanId = (depId || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^dep/, '');
    commit8 = cleanId.length >= 8 ? cleanId.slice(0, 8) : 'abc123ef';
  }
  return `http://${commit8}-127-0-0-1.sslip.io`;
}

export function normalizeDeployment(d: Record<string, unknown>): Deployment {
  let steps: DeploymentStep[] = [];
  if (Array.isArray(d.steps)) {
    steps = d.steps as DeploymentStep[];
  } else if (typeof d.steps === 'string') {
    try {
      steps = JSON.parse(d.steps);
    } catch {
      steps = [];
    }
  }

  const rawStatus = ((d.status as string)?.toLowerCase() as DeploymentStatus) || 'live';

  if (steps.length === 0) {
    if (rawStatus === 'queued' || rawStatus === 'running' || rawStatus === 'building' || rawStatus === 'deploying') {
      steps = [
        { name: 'Queued', status: 'running', startedAt: (d.startedAt as string) || (d.created_at as string) || new Date().toISOString() },
      ];
    } else if (rawStatus === 'live') {
      steps = [
        { name: 'Queued', status: 'success', durationMs: 800 },
        { name: 'Clone', status: 'success', durationMs: 1200 },
        { name: 'Build', status: 'success', durationMs: 3000 },
        { name: 'Push/Load image', status: 'success', durationMs: 1500 },
        { name: 'Deploy', status: 'success', durationMs: 2000 },
        { name: 'Health check', status: 'success', durationMs: 500 },
        { name: 'Live', status: 'success', durationMs: 100 },
      ];
    }
  } else {
    if (rawStatus === 'live') {
      steps = steps.map((s) => ({
        ...s,
        status: s.status === 'failed' ? 'failed' : 'success',
      }));
    } else {
      const stepOrder = [
        'Queued',
        'Clone',
        'Build',
        'Push/Load image',
        'Deploy',
        'Health check',
        'Live',
      ];
      const activeIdx = Math.max(
        ...steps.map((s) => (s.status === 'running' ? stepOrder.indexOf(s.name) : -1))
      );
      if (activeIdx > -1) {
        steps = steps.map((s) => {
          const idx = stepOrder.indexOf(s.name);
          if (idx > -1 && idx < activeIdx && s.status !== 'failed') {
            return { ...s, status: 'success' };
          }
          return s;
        });
      }
    }
  }

  let resolvedCommit = ((d.commitHash as string) || (d.commit_hash as string) || '').trim();
  const previewUrlCandidate = (d.url as string) || (d.previewUrl as string) || (d.preview_url as string) || '';
  if (!resolvedCommit || resolvedCommit === 'main' || resolvedCommit === 'master') {
    const urlMatch = previewUrlCandidate.match(/https?:\/\/([a-f0-9]{7,40})[-.]/i);
    if (urlMatch && urlMatch[1]) {
      resolvedCommit = urlMatch[1];
    }
  }
  if (!resolvedCommit) resolvedCommit = 'main';

  return {
    id: String(d.id),
    serviceId: (d.serviceId as string) || (d.service_id as string) || '',
    serviceName: (d.serviceName as string) || (d.service_name as string) || 'Service',
    commitHash: resolvedCommit,
    commitMessage: (d.commitMessage as string) || (d.commit_message as string) || 'Trigger deployment',
    branch: (d.branch as string) || 'main',
    author: (d.author as string) || 'Admin',
    status: rawStatus,
    steps,
    startedAt: (d.startedAt as string) || (d.created_at as string) || new Date().toISOString(),
    finishedAt: (d.finishedAt as string) || (d.finished_at as string) || undefined,
    durationMs: (d.durationMs as number) || (d.duration_ms as number) || undefined,
    rollbackFromId: d.rollbackFromId as string | undefined,
    isRollback: Boolean(d.isRollback),
    logs: (d.logs as string) || undefined,
    previewUrl:
      (d.serviceType === 'database' ||
      d.service_type === 'database' ||
      Boolean(d.databaseType || d.database_type))
        ? undefined
        : previewUrlCandidate ||
          (resolvedCommit && resolvedCommit !== 'main'
            ? generatePreviewUrl(resolvedCommit, String(d.id))
            : undefined),
  };
}

export async function getDeployments(serviceId?: string): Promise<Deployment[]> {
  const url = serviceId ? `/api/deployments?serviceId=${encodeURIComponent(serviceId)}` : '/api/deployments';
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch deployments (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  const mapped = data.map(normalizeDeployment);
  if (serviceId) {
    return mapped.filter((d) => d.serviceId === serviceId);
  }
  return mapped;
}

export async function getDeploymentById(id: string): Promise<Deployment | null> {
  const res = await fetch(`/api/deployments/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch deployment ${id} (HTTP ${res.status})`);
  }
  const d = await res.json();
  return d && d.id ? normalizeDeployment(d) : null;
}

export async function triggerDeployment(
  serviceId: string, 
  branch = 'main',
  commitHash?: string
): Promise<Deployment> {
  const res = await fetch(`/api/services/${encodeURIComponent(serviceId)}/deploy`, { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch, commitHash }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to trigger deployment for service ${serviceId}`);
  }
  const triggerRes = await res.json();
  const depId = triggerRes.deploymentId || (triggerRes.deployment && triggerRes.deployment.id);
  if (depId) {
    const fetched = await getDeploymentById(depId).catch(() => null);
    if (fetched) return fetched;
  }
  if (triggerRes.deployment) {
    return normalizeDeployment(triggerRes.deployment);
  }
  return {
    id: depId || `dep-${Date.now()}`,
    serviceId,
    serviceName: 'Service',
    commitHash: commitHash || '',
    commitMessage: `deploy: pipeline triggered via console (${branch})`,
    branch,
    author: 'Admin',
    status: (triggerRes.status as DeploymentStatus) || 'queued',
    startedAt: new Date().toISOString(),
    steps: [
      { name: 'Queued', status: 'running', startedAt: new Date().toISOString() },
    ],
  };
}

export async function rollbackDeployment(deploymentId: string): Promise<Deployment> {
  const res = await fetch(`/api/deployments/${encodeURIComponent(deploymentId)}/rollback`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to rollback deployment ${deploymentId}`);
  }
  const triggerRes = await res.json();
  const newDepId = triggerRes.deploymentId || (triggerRes.deployment && triggerRes.deployment.id);
  if (newDepId) {
    const fetched = await getDeploymentById(newDepId).catch(() => null);
    if (fetched) return fetched;
  }
  if (triggerRes.deployment) {
    return normalizeDeployment(triggerRes.deployment);
  }
  return {
    id: newDepId || `dep-${Date.now()}`,
    serviceId: '',
    serviceName: 'Service',
    commitHash: '',
    commitMessage: `rollback: revert to revision of ${deploymentId}`,
    branch: 'main',
    author: 'Admin',
    status: (triggerRes.status as DeploymentStatus) || 'queued',
    startedAt: new Date().toISOString(),
    rollbackFromId: deploymentId,
    isRollback: true,
    steps: [
      { name: 'Queued', status: 'running', startedAt: new Date().toISOString() },
    ],
  };
}

export function getDeploymentLogsStreamUrl(deploymentId: string): string {
  return `/api/sse/deployments/${deploymentId}/logs`;
}

export interface DeploymentLogStreamChunk {
  deployment_id?: string;
  step?: string;
  message: string;
  status?: string;
  is_error?: boolean;
  done?: boolean;
}

export function subscribeDeploymentLogs(
  deploymentId: string,
  onChunk: (chunk: DeploymentLogStreamChunk) => void,
  options?: {
    onStatusChange?: (status: string, step?: string) => void;
    onError?: (err: Event) => void;
  }
): () => void {
  let es: EventSource | null = null;
  let isClosed = false;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (isClosed) return;
    try {
      const url = getDeploymentLogsStreamUrl(deploymentId);
      es = new EventSource(url);

      const handleEvent = (event: MessageEvent) => {
        if (isClosed || !event.data) return;
        retryCount = 0; // reset retry counter on successful reception
        try {
          const parsed = JSON.parse(event.data);
          if (parsed) {
            onChunk(parsed);
            if (parsed.status && options?.onStatusChange) {
              options.onStatusChange(parsed.status, parsed.step);
            }
            if (parsed.done || parsed.status === 'live' || parsed.status === 'failed') {
              isClosed = true;
              es?.close();
            }
            return;
          }
        } catch {
          // Plain text log line
          onChunk({
            deployment_id: deploymentId,
            message: event.data,
          });
        }
      };

      es.addEventListener('log', handleEvent);
      es.onmessage = handleEvent;

      es.onerror = (err) => {
        if (isClosed) return;
        options?.onError?.(err);
        es?.close();
        es = null;

        // Auto-reconnect with exponential backoff if stream was interrupted
        if (!isClosed) {
          const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
          retryCount++;
          retryTimer = setTimeout(connect, delay);
        }
      };
    } catch {
      if (!isClosed) {
        retryTimer = setTimeout(connect, 2000);
      }
    }
  };

  connect();

  return () => {
    isClosed = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (es) {
      es.close();
      es = null;
    }
  };
}
