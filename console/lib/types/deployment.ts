export type DeploymentStepName =
  | 'Queued'
  | 'Clone'
  | 'Build'
  | 'Push/Load image'
  | 'Deploy'
  | 'Health check'
  | 'Live';

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface DeploymentStep {
  name: DeploymentStepName;
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  logs?: string[];
}

export type DeploymentStatus =
  | 'queued'
  | 'running'
  | 'live'
  | 'failed'
  | 'cancelled';

export interface Deployment {
  id: string;
  serviceId: string;
  serviceName: string;
  commitHash: string;
  commitMessage: string;
  branch: string;
  author: string;
  status: DeploymentStatus;
  steps: DeploymentStep[];
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  rollbackFromId?: string;
  isRollback?: boolean;
}
