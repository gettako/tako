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
  }

  return {
    id: String(d.id),
    serviceId: (d.serviceId as string) || (d.service_id as string) || '',
    serviceName: (d.serviceName as string) || 'Service',
    commitHash: (d.commitHash as string) || (d.commit_hash as string) || 'main',
    commitMessage: (d.commitMessage as string) || (d.commit_message as string) || 'Trigger deployment',
    branch: (d.branch as string) || 'main',
    author: (d.author as string) || 'Admin',
    status: ((d.status as string)?.toLowerCase() as DeploymentStatus) || 'live',
    steps,
    startedAt: (d.startedAt as string) || (d.created_at as string) || new Date().toISOString(),
    finishedAt: (d.finishedAt as string) || (d.finished_at as string) || undefined,
    durationMs: (d.durationMs as number) || (d.duration_ms as number) || undefined,
    rollbackFromId: d.rollbackFromId as string | undefined,
    isRollback: Boolean(d.isRollback),
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

export async function triggerDeployment(serviceId: string, branch = 'main'): Promise<Deployment> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${serviceId}/deploy`, { method: 'POST' });
      if (res.ok) {
        const triggerRes = await res.json();
        const depId = triggerRes.deploymentId || `dep-${Date.now()}`;
        const newDep: Deployment = {
          id: depId,
          serviceId,
          serviceName: 'Service',
          commitHash: Math.random().toString(16).substring(2, 9),
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
