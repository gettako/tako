"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  addPasskey,
  getCurrentUser,
  getPasskeys,
  getSessions,
  login,
  loginWithPasskey,
  logout,
  removePasskey,
  revokeAllOtherSessions,
  revokeSession,
  updateCurrentUser,
  updatePassword,
  updateTwoFactor,
} from "@/services/auth.service"
import type { CurrentUserProfile } from "@/types/platform"

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
  sessions: () => [...authKeys.all, "sessions"] as const,
  passkeys: () => [...authKeys.all, "passkeys"] as const,
}

export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => getCurrentUser(),
    retry: false,
    staleTime: 60_000,
  })
}

export function useUpdateCurrentUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      updates,
      current,
    }: {
      updates: Partial<CurrentUserProfile>
      current?: CurrentUserProfile
    }) => updateCurrentUser(updates, current),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() })
    },
  })
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string
      newPassword: string
    }) => updatePassword(currentPassword, newPassword),
  })
}

export function useUpdateTwoFactor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (enabled: boolean) => updateTwoFactor(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me() })
    },
  })
}

export function useSessions() {
  return useQuery({
    queryKey: authKeys.sessions(),
    queryFn: () => getSessions(),
  })
}

export function useRevokeSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.sessions() })
    },
  })
}

export function useRevokeAllOtherSessions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => revokeAllOtherSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.sessions() })
    },
  })
}

export function usePasskeys() {
  return useQuery({
    queryKey: authKeys.passkeys(),
    queryFn: () => getPasskeys(),
  })
}

export function useAddPasskey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      name,
      credentialId,
    }: {
      name: string
      credentialId?: string
    }) => addPasskey(name, credentialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.passkeys() })
    },
  })
}

export function useRemovePasskey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => removePasskey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.passkeys() })
    },
  })
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      email,
      password,
    }: {
      email: string
      password: string
    }) => login(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

export function useLoginWithPasskey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (credentialId?: string) => loginWithPasskey(credentialId),
    onSuccess: () => {
      queryClient.invalidateQueries()
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      queryClient.clear()
    },
  })
}

