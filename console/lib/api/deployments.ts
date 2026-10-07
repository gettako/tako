import { simulateDelay } from './delay';
import { mockDeployments } from '@/lib/mock/data';
import { Deployment, DeploymentStep, DeploymentStatus } from '@/lib/types';

let deployments = [...mockDeployments];

export function setDeploymentsMockData(newDeployments: Deployment[]): void {
  deployments = [...newDeployments];
}

function normalizeDeployment(d: Record<string, unknown>): Deployment {
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
    steps = [
      { name: 'Queued', status: 'success', durationMs: 800 },
      { name: 'Clone', status: 'success', durationMs: 1200 },
      { name: 'Build', status: 'success', durationMs: 3000 },
      { name: 'Push/Load image', status: 'success', durationMs: 1500 },
      { name: 'Deploy', status: 'success', durationMs: 2000 },
      { name: 'Health check', status: 'success', durationMs: 500 },
      { name: 'Live', status: 'success', durationMs: 100 },
    ];
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

  let resolvedCommit = ((d.commitHash as string) || (d.commit_hash as string) || '').trim();
  const previewUrlCandidate = (d.url as string) || (d.previewUrl as string) || (d.preview_url as string) || '';
  if (!resolvedCommit || resolvedCommit === 'main' || resolvedCommit === 'master') {
    const urlMatch = previewUrlCandidate.match(/https?:\/\/([a-f0-9]{7,40})[-.]/i);
    if (urlMatch && urlMatch[1]) {
      resolvedCommit = urlMatch[1];
    } else if (d.id) {
      const cleanId = String(d.id).replace(/^dep-/, '');
      if (cleanId.length >= 7) {
        resolvedCommit = cleanId.slice(0, 8);
      }
    }
  }
  if (!resolvedCommit) resolvedCommit = 'main';

  return {
    id: String(d.id),
    serviceId: (d.serviceId as string) || (d.service_id as string) || '',
    serviceName: (d.serviceName as string) || 'Service',
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
      previewUrlCandidate ||
      generatePreviewUrl(resolvedCommit, String(d.id)),
  };
}

export async function getDeployments(serviceId?: string): Promise<Deployment[]> {
  if (typeof window !== 'undefined') {
    try {
      const url = serviceId ? `/api/deployments?serviceId=${encodeURIComponent(serviceId)}` : '/api/deployments';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped = data.map(normalizeDeployment);
          if (serviceId) {
            return mapped.filter((d) => d.serviceId === serviceId);
          }
          return mapped;
        }
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay();
  if (serviceId) {
    return deployments.filter((d) => d.serviceId === serviceId);
  }
  return [...deployments];
}

export async function getDeploymentById(id: string): Promise<Deployment | null> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/deployments/${id}`);
      if (res.ok) {
        const d = await res.json();
        if (d && d.id) {
          return normalizeDeployment(d);
        }
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay();
  const dep = deployments.find((d) => d.id === id);
  return dep ? { ...dep } : null;
}

export async function triggerDeployment(
  serviceId: string, 
  branch = 'main',
  commitHash?: string
): Promise<Deployment> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${serviceId}/deploy`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch, commitHash }),
      });
      if (res.ok) {
        const triggerRes = await res.json();
        const depId = triggerRes.deploymentId || `dep-${Date.now()}`;
        const newDep: Deployment = {
          id: depId,
          serviceId,
          serviceName: 'Service',
          commitHash: commitHash || '',
          commitMessage: `deploy: pipeline triggered via console (${branch})`,
          branch,
          author: 'Admin',
          status: 'running',
          startedAt: new Date().toISOString(),
          steps: [
            { name: 'Queued', status: 'success', durationMs: 500 },
            { name: 'Clone', status: 'running', logs: ['Initiating git clone...'] },
            { name: 'Build', status: 'pending' },
            { name: 'Push/Load image', status: 'pending' },
            { name: 'Deploy', status: 'pending' },
            { name: 'Health check', status: 'pending' },
            { name: 'Live', status: 'pending' },
          ],
        };
        deployments.unshift(newDep);
        return newDep;
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay();
  const newDeployment: Deployment = {
    id: `dep-${Date.now()}`,
    serviceId,
    serviceName: 'Service',
    commitHash: Math.random().toString(16).substring(2, 9),
    commitMessage: `chore: triggered manual deployment on ${branch}`,
    branch,
    author: 'Current User',
    status: 'running',
    startedAt: new Date().toISOString(),
    steps: [
      { name: 'Queued', status: 'success', durationMs: 800 },
      { name: 'Clone', status: 'running', logs: ['Initiating git checkout...'] },
      { name: 'Build', status: 'pending' },
      { name: 'Push/Load image', status: 'pending' },
      { name: 'Deploy', status: 'pending' },
      { name: 'Health check', status: 'pending' },
      { name: 'Live', status: 'pending' },
    ],
  };

  deployments.unshift(newDeployment);
  return newDeployment;
}

export async function rollbackDeployment(deploymentId: string): Promise<Deployment> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/deployments/${deploymentId}/rollback`, { method: 'POST' });
      if (res.ok) {
        const triggerRes = await res.json();
        const newDepId = triggerRes.deploymentId || `dep-${Date.now()}`;
        const target = deployments.find((d) => d.id === deploymentId);
        const rollbackDep: Deployment = {
          id: newDepId,
          serviceId: target?.serviceId || '',
          serviceName: target?.serviceName || 'Service',
          commitHash: target?.commitHash || '',
          commitMessage: `rollback: revert to ${target?.commitHash || 'previous'} (${target?.commitMessage || ''})`,
          branch: target?.branch || 'main',
          author: 'Admin',
          status: 'running',
          startedAt: new Date().toISOString(),
          rollbackFromId: deploymentId,
          isRollback: true,
          steps: [
            { name: 'Queued', status: 'success', durationMs: 500 },
            { name: 'Clone', status: 'running', logs: ['Reverting to revision...'] },
            { name: 'Build', status: 'pending' },
            { name: 'Push/Load image', status: 'pending' },
            { name: 'Deploy', status: 'pending' },
            { name: 'Health check', status: 'pending' },
            { name: 'Live', status: 'pending' },
          ],
        };
        deployments.unshift(rollbackDep);
        return rollbackDep;
      }
    } catch {
      // Fallback
    }
  }

  await simulateDelay();
  const target = deployments.find((d) => d.id === deploymentId);
  if (!target) throw new Error(`Deployment ${deploymentId} not found`);

  const rollbackDep: Deployment = {
    id: `dep-${Date.now()}`,
    serviceId: target.serviceId,
    serviceName: target.serviceName,
    commitHash: target.commitHash,
    commitMessage: `rollback: revert to ${target.commitHash} (${target.commitMessage})`,
    branch: target.branch,
    author: 'Current User',
    status: 'running',
    startedAt: new Date().toISOString(),
    rollbackFromId: target.id,
    isRollback: true,
    steps: [
      { name: 'Queued', status: 'success', durationMs: 500 },
      { name: 'Clone', status: 'success', durationMs: 1200 },
      { name: 'Build', status: 'success', durationMs: 4000 },
      { name: 'Push/Load image', status: 'success', durationMs: 1500 },
      { name: 'Deploy', status: 'running', logs: ['Rolling back container image...'] },
      { name: 'Health check', status: 'pending' },
      { name: 'Live', status: 'pending' },
    ],
  };

  deployments.unshift(rollbackDep);
  return rollbackDep;
}

export function getDeploymentLogsStreamUrl(deploymentId: string): string {
  return `/api/sse/deployments/${deploymentId}/logs`;
}

