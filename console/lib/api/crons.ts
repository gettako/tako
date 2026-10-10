import { simulateDelay } from './delay';
import { mockCronJobs, mockCronJobRuns } from '@/lib/mock/data';
import { CronJob, CronJobRun, CreateCronJobInput, UpdateCronJobInput } from '@/lib/types';

let cronJobs = [...mockCronJobs];
let cronJobRuns = [...mockCronJobRuns];

async function fetchFromBFF<T>(key: string, fallback: T): Promise<T> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/settings/${key}`);
      if (res.ok) {
        const data = await res.json();
        if (data !== undefined && data !== null) {
          return data as T;
        }
      }
    } catch {
      // fallback
    }
  }
  return fallback;
}

async function saveToBFF<T>(key: string, value: T): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
    } catch {
      // fallback
    }
  }
}

export async function getCronJobs(serviceId: string): Promise<CronJob[]> {
  const remote = await fetchFromBFF<CronJob[] | null>(`cron_jobs_${serviceId}`, null);
  if (remote && Array.isArray(remote)) {
    cronJobs = [
      ...cronJobs.filter((j) => j.serviceId !== serviceId),
      ...remote,
    ];
    return remote;
  }
  await simulateDelay();
  return cronJobs.filter((job) => job.serviceId === serviceId);
}

export async function getCronJobRuns(cronJobId: string): Promise<CronJobRun[]> {
  const remote = await fetchFromBFF<CronJobRun[] | null>(`cron_runs_${cronJobId}`, null);
  if (remote && Array.isArray(remote)) {
    cronJobRuns = [
      ...cronJobRuns.filter((r) => r.cronJobId !== cronJobId),
      ...remote,
    ];
    return remote.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }
  await simulateDelay();
  return cronJobRuns
    .filter((run) => run.cronJobId === cronJobId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export async function createCronJob(input: CreateCronJobInput): Promise<CronJob> {
  await simulateDelay();
  const newJob: CronJob = {
    id: `cron-${Date.now()}`,
    serviceId: input.serviceId,
    name: input.name,
    schedule: input.schedule,
    command: input.command,
    status: 'active',
    createdAt: new Date().toISOString(),
    nextRunAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
  };

  cronJobs.unshift(newJob);
  const serviceJobs = cronJobs.filter((j) => j.serviceId === input.serviceId);
  await saveToBFF(`cron_jobs_${input.serviceId}`, serviceJobs);
  return { ...newJob };
}

export async function updateCronJob(id: string, input: UpdateCronJobInput): Promise<CronJob> {
  await simulateDelay();
  const index = cronJobs.findIndex((j) => j.id === id);
  if (index === -1) throw new Error(`Cron job ${id} not found`);

  const updated: CronJob = {
    ...cronJobs[index],
    name: input.name !== undefined ? input.name : cronJobs[index].name,
    schedule: input.schedule !== undefined ? input.schedule : cronJobs[index].schedule,
    command: input.command !== undefined ? input.command : cronJobs[index].command,
    status: input.status !== undefined ? input.status : cronJobs[index].status,
  };

  cronJobs[index] = updated;
  const serviceJobs = cronJobs.filter((j) => j.serviceId === updated.serviceId);
  await saveToBFF(`cron_jobs_${updated.serviceId}`, serviceJobs);
  return { ...updated };
}

export async function toggleCronJobStatus(id: string): Promise<CronJob> {
  await simulateDelay();
  const index = cronJobs.findIndex((j) => j.id === id);
  if (index === -1) throw new Error(`Cron job ${id} not found`);

  const current = cronJobs[index];
  const newStatus = current.status === 'active' ? 'paused' : 'active';
  cronJobs[index] = { ...current, status: newStatus };
  const serviceJobs = cronJobs.filter((j) => j.serviceId === current.serviceId);
  await saveToBFF(`cron_jobs_${current.serviceId}`, serviceJobs);
  return { ...cronJobs[index] };
}

export async function runCronJobNow(id: string): Promise<CronJobRun> {
  const index = cronJobs.findIndex((j) => j.id === id);
  if (index === -1) throw new Error(`Cron job ${id} not found`);

  const job = cronJobs[index];
  const startTime = Date.now();
  const startDate = new Date();
  let output = '';
  let exitCode = 0;
  let status: 'success' | 'failed' = 'success';

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/services/${job.serviceId}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: job.command }),
      });
      if (res.ok) {
        const data = await res.json();
        const stdOut = data.stdout || data.output || '';
        const stdErr = data.stderr || '';
        output = stdOut;
        if (stdErr) {
          output = output ? `${output}\n${stdErr}` : stdErr;
        }
        if (!output) {
          output = `> ${job.command}\nProcess exited with status 0 (Success)`;
        }
        exitCode = data.exitCode !== undefined ? data.exitCode : 0;
        status = exitCode === 0 ? 'success' : 'failed';
      } else {
        const errJson = await res.json().catch(() => ({}));
        output = errJson.error || `HTTP ${res.status}: Failed to execute in container`;
        exitCode = 1;
        status = 'failed';
      }
    } catch (err: unknown) {
      output = err instanceof Error ? err.message : 'Execution error';
      exitCode = 1;
      status = 'failed';
    }
  } else {
    await simulateDelay(200, 400);
    output = `> ${job.command}\nCommand executed successfully.`;
  }

  const durationMs = Math.max(12, Date.now() - startTime);
  const finishDate = new Date();

  const newRun: CronJobRun = {
    id: `run-${Date.now()}`,
    cronJobId: id,
    startedAt: startDate.toISOString(),
    finishedAt: finishDate.toISOString(),
    durationMs,
    status,
    exitCode,
    output,
  };

  cronJobRuns.unshift(newRun);

  // Update job lastRun
  cronJobs[index] = {
    ...job,
    lastRunAt: startDate.toISOString(),
    lastStatus: status,
  };

  const serviceJobs = cronJobs.filter((j) => j.serviceId === job.serviceId);
  const jobRuns = cronJobRuns.filter((r) => r.cronJobId === id);
  await saveToBFF(`cron_jobs_${job.serviceId}`, serviceJobs);
  await saveToBFF(`cron_runs_${id}`, jobRuns);

  return { ...newRun };
}

export async function deleteCronJob(id: string): Promise<void> {
  await simulateDelay();
  const job = cronJobs.find((j) => j.id === id);
  cronJobs = cronJobs.filter((j) => j.id !== id);
  if (job) {
    const serviceJobs = cronJobs.filter((j) => j.serviceId === job.serviceId);
    await saveToBFF(`cron_jobs_${job.serviceId}`, serviceJobs);
  }
}
