export interface CronJob {
  id: string;
  serviceId: string;
  name: string;
  schedule: string;
  command: string;
  status: 'active' | 'paused';
  lastRunAt?: string;
  nextRunAt?: string;
  lastStatus?: 'success' | 'failed';
  createdAt: string;
}

export interface CronJobRun {
  id: string;
  cronJobId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'success' | 'failed';
  exitCode: number;
  output: string;
}

export interface CreateCronJobInput {
  serviceId: string;
  name: string;
  schedule: string;
  command: string;
}

export interface UpdateCronJobInput {
  name?: string;
  schedule?: string;
  command?: string;
  status?: 'active' | 'paused';
}
