import { CronJob, CronJobRun, CreateCronJobInput, UpdateCronJobInput } from '@/lib/types';

const jobServiceMap = new Map<string, string>();

export async function getCronJobs(serviceId: string): Promise<CronJob[]> {
  const res = await fetch(`/api/services/${encodeURIComponent(serviceId)}/crons`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch cron jobs: ${res.status}`);
  }
  const data: CronJob[] = await res.json();
  data.forEach((job) => {
    jobServiceMap.set(job.id, serviceId);
  });
  return data;
}

export async function getCronJobRuns(cronJobId: string, serviceId?: string): Promise<CronJobRun[]> {
  const resolvedServiceId = serviceId || jobServiceMap.get(cronJobId);
  if (!resolvedServiceId) {
    return [];
  }
  const res = await fetch(
    `/api/services/${encodeURIComponent(resolvedServiceId)}/crons/${encodeURIComponent(cronJobId)}/runs`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch cron runs: ${res.status}`);
  }
  return res.json();
}

export async function createCronJob(input: CreateCronJobInput): Promise<CronJob> {
  const res = await fetch(`/api/services/${encodeURIComponent(input.serviceId)}/crons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      schedule: input.schedule,
      command: input.command,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create cron job: ${res.status}`);
  }
  const data: CronJob = await res.json();
  jobServiceMap.set(data.id, input.serviceId);
  return data;
}

export async function updateCronJob(
  id: string,
  input: UpdateCronJobInput,
  serviceId?: string
): Promise<CronJob> {
  const resolvedServiceId = serviceId || jobServiceMap.get(id);
  if (!resolvedServiceId) {
    throw new Error(`Cannot locate service for cron job ${id}`);
  }
  const res = await fetch(
    `/api/services/${encodeURIComponent(resolvedServiceId)}/crons/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update cron job: ${res.status}`);
  }
  return res.json();
}

export async function toggleCronJobStatus(id: string, serviceId?: string): Promise<CronJob> {
  const resolvedServiceId = serviceId || jobServiceMap.get(id);
  if (!resolvedServiceId) {
    throw new Error(`Cannot locate service for cron job ${id}`);
  }
  const jobRes = await fetch(
    `/api/services/${encodeURIComponent(resolvedServiceId)}/crons/${encodeURIComponent(id)}`
  );
  const currentJob: CronJob = await jobRes.json();
  const nextStatus = currentJob.status === 'active' ? 'paused' : 'active';

  return updateCronJob(id, { status: nextStatus }, resolvedServiceId);
}

export async function runCronJobNow(id: string, serviceId?: string): Promise<CronJobRun> {
  const resolvedServiceId = serviceId || jobServiceMap.get(id);
  if (!resolvedServiceId) {
    throw new Error(`Cannot locate service for cron job ${id}`);
  }
  const res = await fetch(
    `/api/services/${encodeURIComponent(resolvedServiceId)}/crons/${encodeURIComponent(id)}/run`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to trigger cron job: ${res.status}`);
  }
  return res.json();
}

export async function deleteCronJob(id: string, serviceId?: string): Promise<void> {
  const resolvedServiceId = serviceId || jobServiceMap.get(id);
  if (!resolvedServiceId) {
    throw new Error(`Cannot locate service for cron job ${id}`);
  }
  const res = await fetch(
    `/api/services/${encodeURIComponent(resolvedServiceId)}/crons/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete cron job: ${res.status}`);
  }
  jobServiceMap.delete(id);
}
