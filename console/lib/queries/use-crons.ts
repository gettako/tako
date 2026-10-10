'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cronKeys } from './keys';
import {
  getCronJobs,
  getCronJobRuns,
  createCronJob,
  updateCronJob,
  toggleCronJobStatus,
  runCronJobNow,
  deleteCronJob,
} from '@/lib/api/crons';
import { CronJob, CronJobRun, CreateCronJobInput, UpdateCronJobInput } from '@/lib/types';
import { toast } from 'sonner';

export function useCronJobs(serviceId: string | undefined | null) {
  return useQuery<CronJob[]>({
    queryKey: serviceId ? cronKeys.lists(serviceId) : ['crons', 'list', 'none'],
    queryFn: () => (serviceId ? getCronJobs(serviceId) : Promise.resolve([])),
    enabled: Boolean(serviceId),
  });
}

export function useCronJobRuns(cronJobId: string | undefined | null) {
  return useQuery<CronJobRun[]>({
    queryKey: cronJobId ? cronKeys.runs(cronJobId) : ['crons', 'runs', 'none'],
    queryFn: () => (cronJobId ? getCronJobRuns(cronJobId) : Promise.resolve([])),
    enabled: Boolean(cronJobId),
  });
}

export function useCreateCronJob(serviceId: string, options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<CronJob, Error, CreateCronJobInput>({
    mutationFn: createCronJob,
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: cronKeys.lists(serviceId) });
      toast.success(`Cron job "${job.name}" created`);
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create cron job');
    },
  });
}

export function useUpdateCronJob(serviceId: string, options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<CronJob, Error, { id?: string; jobId?: string; input: UpdateCronJobInput }>({
    mutationFn: ({ id, jobId, input }) => updateCronJob(id || jobId || '', input),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: cronKeys.lists(serviceId) });
      toast.success(`Cron job "${job.name}" updated`);
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update cron job');
    },
  });
}

export function useToggleCronJob(serviceId: string) {
  const queryClient = useQueryClient();

  return useMutation<CronJob, Error, string>({
    mutationFn: toggleCronJobStatus,
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: cronKeys.lists(serviceId) });
      toast.success(`Cron job is now ${job.status}`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to toggle cron job');
    },
  });
}

export function useRunCronJob(serviceId: string, options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<CronJobRun, Error, string>({
    mutationFn: runCronJobNow,
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: cronKeys.lists(serviceId) });
      queryClient.invalidateQueries({ queryKey: cronKeys.runs(run.cronJobId) });
      toast.success('Cron job execution finished', {
        description: `Exit code: ${run.exitCode} (${run.status})`,
      });
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Cron execution failed');
    },
  });
}

export function useDeleteCronJob(serviceId: string, options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteCronJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cronKeys.lists(serviceId) });
      toast.success('Cron job deleted');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete cron job');
    },
  });
}
