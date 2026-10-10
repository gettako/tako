'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileKeys, userKeys } from './keys';
import {
  getCurrentUser,
  updateCurrentUser,
  changePassword,
  get2FASetup,
  verifyAndEnable2FA,
  disable2FA,
  getSessions,
  revokeSession,
  revokeAllOtherSessions,
  getPasskeys,
  deletePasskey,
  registerPasskeyWithWebAuthn,
} from '@/lib/api/profile';
import { logout } from '@/lib/api/auth';
import { User, Session, Passkey } from '@/lib/types';
import { toast } from 'sonner';

export function useProfileUser() {
  return useQuery<User>({
    queryKey: userKeys.current(),
    queryFn: getCurrentUser,
  });
}

export function useUpdateProfileUser(options?: { onSuccess?: (u: User) => void }) {
  const queryClient = useQueryClient();

  return useMutation<User, Error, Partial<User>>({
    mutationFn: updateCurrentUser,
    onSuccess: (u) => {
      queryClient.setQueryData(userKeys.current(), u);
      queryClient.invalidateQueries({ queryKey: userKeys.current() });
      toast.success('Profile updated');
      options?.onSuccess?.(u);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update profile');
    },
  });
}

export function useChangePassword(options?: {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}) {
  return useMutation<void, Error, { currentPassword: string; newPassword: string }>({
    mutationFn: ({ currentPassword, newPassword }) => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success('Password updated successfully');
      options?.onSuccess?.();
    },
    onError: (err) => {
      if (options?.onError) {
        options.onError(err);
      } else {
        toast.error(err.message || 'Failed to update password');
      }
    },
  });
}

export function use2FASetup(enabled = false) {
  return useQuery<{ secret: string; otpauthUrl: string; recoveryCodes: string[] }>({
    queryKey: profileKeys.twoFactorSetup(),
    queryFn: get2FASetup,
    enabled,
  });
}

export function useVerifyAndEnable2FA(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { code: string; secret: string; recoveryCodes: string[] }>({
    mutationFn: ({ code, secret, recoveryCodes }) => verifyAndEnable2FA(code, secret, recoveryCodes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.current() });
      toast.success('Two-factor authentication enabled');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Invalid verification code');
    },
  });
}

export function useDisable2FA(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: disable2FA,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.current() });
      toast.success('Two-factor authentication disabled');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to disable 2FA');
    },
  });
}

// Sessions
export function useSessions() {
  return useQuery<Session[]>({
    queryKey: profileKeys.sessions(),
    queryFn: getSessions,
  });
}

export function useRevokeSession(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.sessions() });
      toast.success('Session revoked');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to revoke session');
    },
  });
}

export function useRevokeAllOtherSessions(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string | void>({
    mutationFn: (currentSessionId) => revokeAllOtherSessions(currentSessionId || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.sessions() });
      toast.success('All other sessions revoked');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to revoke other sessions');
    },
  });
}

// Passkeys
export function usePasskeys() {
  return useQuery<Passkey[]>({
    queryKey: profileKeys.passkeys(),
    queryFn: getPasskeys,
  });
}

export function useDeletePasskey(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deletePasskey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.passkeys() });
      toast.success('Passkey deleted');
      options?.onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete passkey');
    },
  });
}

export function useRegisterPasskey(options?: {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<Passkey, Error, string | undefined>({
    mutationFn: (name) => registerPasskeyWithWebAuthn(name || 'Security Key'),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.passkeys() });
      toast.success(`Passkey "${p.name}" registered successfully`);
      options?.onSuccess?.();
    },
    onError: (err) => {
      if (options?.onError) {
        options.onError(err);
      } else {
        toast.error(err.message || 'Passkey registration cancelled or failed');
      }
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to sign out');
    },
  });
}

