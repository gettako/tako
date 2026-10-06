import { simulateDelay } from './delay';
import { mockDeployments } from '@/lib/mock/data';
import { Deployment } from '@/lib/types';

let deployments = [...mockDeployments];

export function setDeploymentsMockData(newDeployments: Deployment[]): void {
  deployments = [...newDeployments];
}

export async function getDeployments(serviceId?: string): Promise<Deployment[]> {
  await simulateDelay();
  if (serviceId) {
    return deployments.filter((d) => d.serviceId === serviceId);
  }
  return [...deployments];
}

export async function getDeploymentById(id: string): Promise<Deployment | null> {
  await simulateDelay();
  const dep = deployments.find((d) => d.id === id);
  return dep ? { ...dep } : null;
}

export async function triggerDeployment(serviceId: string, branch = 'main'): Promise<Deployment> {
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
