'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupKeys } from './keys';
import {
  getServiceBackups,
  createServiceBackup,
  deleteServiceBackup,
  restoreServiceBackup,
  BackupItem,
} from '@/lib/api/backups';
import { toast } from 'sonner';

export function useServiceBackups(serviceId: string, serviceSlug = 'database') {
  return useQuery<BackupItem[]>({
    queryKey: backupKeys.lists(serviceId),
    queryFn: () => getServiceBackups(serviceId, serviceSlug),
    enabled: Boolean(serviceId),
  });
}

export function useCreateServiceBackup(serviceId: string, serviceSlug = 'database') {
  const queryClient = useQueryClient();

  return useMutation<BackupItem, Error, void>({
    mutationFn: () => createServiceBackup(serviceId, serviceSlug),
    onSuccess: (backup) => {
      queryClient.invalidateQueries({ queryKey: backupKeys.lists(serviceId) });
      toast.success('Database backup created', { description: backup.name });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create backup');
    },
  });
}

export function useDeleteServiceBackup(
  serviceId: string,
  serviceSlug = 'database',
  options?: { onSuccess?: () => void }
) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (backupId) => deleteServiceBackup(serviceId, backupId, serviceSlug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: backupKeys.lists(serviceId) });
      toast.success('Backup deleted');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete backup');
    },
  });
}

export function useRestoreServiceBackup(serviceId: string) {
  return useMutation<void, Error, string>({
    mutationFn: (backupName) => restoreServiceBackup(serviceId, backupName),
    onSuccess: (_, backupName) => {
      toast.success('Backup restoration completed', { description: backupName });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to restore backup');
    },
  });
}
