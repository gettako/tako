"use client"

import * as React from "react"
import { SettingsHeader } from "@/components/settings-header"
import {
  UsersIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  FingerprintIcon,
  PencilSimpleIcon,
  TrashIcon,
  CircleNotchIcon,
  WarningIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  LinkSimpleIcon,
  ClockIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CopyButton } from "@/components/ui/copy-button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  useApi,
  ApiError,
  type User,
  type UserRole,
  type Invite,
  type AdminUser,
} from "@/lib/api"
import { cn, getDiceBearAvatar } from "@/lib/utils"

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  } catch {
    return dateStr
  }
}

export default function SettingsUsersPage() {
  const api = useApi()

  // State
  const [users, setUsers] = React.useState<User[]>([])
  const [invites, setInvites] = React.useState<Invite[]>([])
  const [currentUser, setCurrentUser] = React.useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [fetchError, setFetchError] = React.useState<string | null>(null)

  // Notification Banner
  const [banner, setBanner] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Invite Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false)
  const [inviteRole, setInviteRole] = React.useState<UserRole>("member")
  const [isCreatingInvite, setIsCreatingInvite] = React.useState(false)
  const [inviteError, setInviteError] = React.useState<string | null>(null)
  const [generatedInviteUrl, setGeneratedInviteUrl] = React.useState<
    string | null
  >(null)

  // Change Role Dialog
  const [roleModalUser, setRoleModalUser] = React.useState<User | null>(null)
  const [selectedRole, setSelectedRole] = React.useState<UserRole>("member")
  const [isUpdatingRole, setIsUpdatingRole] = React.useState(false)
  const [roleError, setRoleError] = React.useState<string | null>(null)

  // Delete User Dialog
  const [deletingUser, setDeletingUser] = React.useState<User | null>(null)
  const [isDeletingUser, setIsDeletingUser] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  // Revoking Invite
  const [revokingInviteId, setRevokingInviteId] = React.useState<string | null>(
    null
  )

  const loadData = React.useCallback(async () => {
    try {
      const [usersData, invitesData, meData] = await Promise.all([
        api.users.list(),
        api.invites.list(),
        api.auth.getMe().catch(() => null),
      ])
      setUsers(usersData)
      setInvites(invitesData)
      setCurrentUser(meData)
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load users."
      setFetchError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [api])

  React.useEffect(() => {
    let mounted = true
    async function init() {
      try {
        const [usersData, invitesData, meData] = await Promise.all([
          api.users.list(),
          api.invites.list(),
          api.auth.getMe().catch(() => null),
        ])
        if (mounted) {
          setUsers(usersData)
          setInvites(invitesData)
          setCurrentUser(meData)
        }
      } catch (err) {
        if (mounted) {
          const msg =
            err instanceof ApiError ? err.message : "Failed to load users."
          setFetchError(msg)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }
    init()
    return () => {
      mounted = false
    }
  }, [api])

  const openInviteModal = () => {
    setInviteRole("member")
    setInviteError(null)
    setGeneratedInviteUrl(null)
    setIsInviteModalOpen(true)
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingInvite(true)
    setInviteError(null)

    try {
      const res = await api.invites.create({ role: inviteRole })
      const fullUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/register?token=${encodeURIComponent(res.token)}`
          : `/register?token=${encodeURIComponent(res.token)}`
      setGeneratedInviteUrl(fullUrl)

      // Refresh invites list in background
      api.invites
        .list()
        .then(setInvites)
        .catch(() => {})
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to create invitation."
      setInviteError(msg)
    } finally {
      setIsCreatingInvite(false)
    }
  }

  const openChangeRoleModal = (user: User) => {
    setRoleModalUser(user)
    setSelectedRole(user.role)
    setRoleError(null)
  }

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roleModalUser) return

    setIsUpdatingRole(true)
    setRoleError(null)

    try {
      await api.users.updateRole(roleModalUser.id, { role: selectedRole })
      setBanner({
        type: "success",
        message: `Role for ${roleModalUser.name} updated to ${selectedRole}.`,
      })
      setRoleModalUser(null)
      loadData()
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to update user role."
      setRoleError(msg)
    } finally {
      setIsUpdatingRole(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return

    setIsDeletingUser(true)
    setDeleteError(null)

    try {
      await api.users.delete(deletingUser.id)
      setBanner({
        type: "success",
        message: `User ${deletingUser.name} was removed. Active sessions were terminated.`,
      })
      setDeletingUser(null)
      loadData()
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete user."
      setDeleteError(msg)
    } finally {
      setIsDeletingUser(false)
    }
  }

  const handleRevokeInvite = async (inviteId: string) => {
    setRevokingInviteId(inviteId)
    try {
      await api.invites.revoke(inviteId)
      setBanner({
        type: "success",
        message: "Invitation link revoked successfully.",
      })
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to revoke invitation."
      setBanner({ type: "error", message: msg })
    } finally {
      setRevokingInviteId(null)
    }
  }

  const adminCount = users.filter((u) => u.role === "admin").length

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      <SettingsHeader
        title="Users"
        description="Manage cluster users, assign roles (Admin / Member), and invite collaborators."
        action={
          <Button onClick={openInviteModal} className="gap-2">
            <UserPlusIcon className="size-4" />
            <span>Invite User</span>
          </Button>
        }
      />

      {/* Global Feedback Banner */}
      {banner && (
        <div
          role="alert"
          className={cn(
            "flex items-center justify-between rounded-lg border px-4 py-3 text-sm",
            banner.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          <div className="flex items-center gap-2">
            {banner.type === "success" ? (
              <CheckCircleIcon className="size-5 shrink-0" />
            ) : (
              <WarningIcon className="size-5 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div
          data-testid="users-loading-state"
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
        >
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
          <div className="mt-4 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 w-full animate-pulse rounded-md bg-muted/60"
              />
            ))}
          </div>
        </div>
      ) : fetchError ? (
        <div
          role="alert"
          data-testid="users-error-state"
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-card p-8 text-center"
        >
          <WarningIcon className="size-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">{fetchError}</p>
          <Button
            variant="outline"
            onClick={loadData}
            className="flex items-center gap-2 text-xs"
          >
            <span>Retry</span>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Active Users Table Card */}
          <div
            data-testid="users-table-section"
            className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
          >
            <div className="border-b border-border bg-muted/20 px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UsersIcon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Collaborators ({users.length})
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  Single workspace: all members share access to cluster
                  resources
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
                  <tr>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Authentication</th>
                    <th className="px-5 py-3">Joined</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => {
                    const isSelf = currentUser?.id === user.id
                    const isLastAdmin = user.role === "admin" && adminCount <= 1

                    return (
                      <tr
                        key={user.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        {/* Column 1: User info & avatar */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar size="sm" className="size-8">
                              <AvatarImage
                                src={getDiceBearAvatar(user.email)}
                                alt={user.name}
                              />
                              <AvatarFallback>
                                {user.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">
                                  {user.name}
                                </span>
                                {isSelf && (
                                  <span className="py-0.2 rounded border border-primary/30 bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {user.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Column 2: Role Badge */}
                        <td className="px-5 py-4">
                          {user.role === "admin" ? (
                            <span className="inline-flex items-center rounded border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-purple-700 uppercase dark:text-purple-400">
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-400">
                              Member
                            </span>
                          )}
                        </td>

                        {/* Column 3: Security & 2FA / Passkey indicators */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3 text-xs">
                            <span
                              className={cn(
                                "flex items-center gap-1",
                                user.two_factor_enabled
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-muted-foreground"
                              )}
                              title={
                                user.two_factor_enabled
                                  ? "Two-factor authentication active"
                                  : "Two-factor authentication disabled"
                              }
                            >
                              <ShieldCheckIcon className="size-4 shrink-0" />
                              <span>
                                {user.two_factor_enabled ? "2FA" : "No 2FA"}
                              </span>
                            </span>
                            <span
                              className={cn(
                                "flex items-center gap-1",
                                user.passkeys_enabled
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-muted-foreground"
                              )}
                              title={
                                user.passkeys_enabled
                                  ? "Passkey registered"
                                  : "No passkeys registered"
                              }
                            >
                              <FingerprintIcon className="size-4 shrink-0" />
                              <span>
                                {user.passkeys_enabled
                                  ? "Passkey"
                                  : "No Passkey"}
                              </span>
                            </span>
                          </div>
                        </td>

                        {/* Column 4: Joined date */}
                        <td className="px-5 py-4 text-xs text-muted-foreground">
                          {formatDate(user.created_at)}
                        </td>

                        {/* Column 5: Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Change Role Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isSelf || isLastAdmin}
                              onClick={() => openChangeRoleModal(user)}
                              className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                              title={
                                isSelf
                                  ? "Cannot change your own role"
                                  : isLastAdmin
                                    ? "Cannot demote the only remaining admin"
                                    : "Modify user role"
                              }
                            >
                              <PencilSimpleIcon className="size-3.5" />
                              <span>Role</span>
                            </Button>

                            {/* Remove User Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isSelf || isLastAdmin}
                              onClick={() => {
                                setDeleteError(null)
                                setDeletingUser(user)
                              }}
                              className="h-8 gap-1.5 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                              title={
                                isSelf
                                  ? "Cannot remove your own account"
                                  : isLastAdmin
                                    ? "Cannot remove the only remaining admin"
                                    : "Remove user from workspace"
                              }
                            >
                              <TrashIcon className="size-3.5" />
                              <span>Remove</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Invitations Section */}
          <div
            data-testid="invites-table-section"
            className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
          >
            <div className="border-b border-border bg-muted/20 px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <EnvelopeSimpleIcon className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Pending Invitations ({invites.length})
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  Single-use registration links valid for 7 days
                </span>
              </div>
            </div>

            {invites.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <p className="text-xs text-muted-foreground">
                  No active pending invitations. Click &quot;Invite User&quot;
                  above to generate a new registration link.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
                    <tr>
                      <th className="px-5 py-3">Target Role</th>
                      <th className="px-5 py-3">Created</th>
                      <th className="px-5 py-3">Expires</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invites.map((invite) => {
                      const isRevoking = revokingInviteId === invite.id
                      return (
                        <tr
                          key={invite.id}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <td className="px-5 py-4">
                            {invite.role === "admin" ? (
                              <span className="inline-flex items-center rounded border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-purple-700 uppercase dark:text-purple-400">
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-400">
                                Member
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            {formatDate(invite.created_at)}
                          </td>
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <ClockIcon className="size-3.5 text-muted-foreground" />
                              <span>{formatDate(invite.expires_at)}</span>
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isRevoking}
                              onClick={() => handleRevokeInvite(invite.id)}
                              className="h-8 gap-1.5 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                              title="Revoke this invitation"
                            >
                              {isRevoking ? (
                                <CircleNotchIcon className="size-3.5 animate-spin" />
                              ) : (
                                <TrashIcon className="size-3.5" />
                              )}
                              <span>Revoke</span>
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite User Dialog */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Invite Collaborator</DialogTitle>
            <DialogDescription>
              Generate a single-use registration URL for a member to join the
              Tako cluster.
            </DialogDescription>
          </DialogHeader>

          {inviteError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <WarningIcon className="size-4 shrink-0" />
              <span>{inviteError}</span>
            </div>
          )}

          {!generatedInviteUrl ? (
            <form onSubmit={handleCreateInvite} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-foreground">
                  Select Role
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInviteRole("member")}
                    className={cn(
                      "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                      inviteRole === "member"
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    <span className="text-sm font-semibold text-foreground">
                      Member
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Can manage projects, services, deployments, and logs.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteRole("admin")}
                    className={cn(
                      "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                      inviteRole === "admin"
                        ? "border-purple-500 bg-purple-500/5 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    <span className="text-sm font-semibold text-foreground">
                      Admin
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Full access including server nodes, user management, and
                      global settings.
                    </span>
                  </button>
                </div>
              </div>

              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                The invitation link will expire automatically in 7 days and can
                only be used once.
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreatingInvite}
                  className="gap-2"
                >
                  {isCreatingInvite ? (
                    <>
                      <CircleNotchIcon className="size-4 animate-spin" />
                      <span>Generating Link...</span>
                    </>
                  ) : (
                    <>
                      <LinkSimpleIcon className="size-4" />
                      <span>Generate Invite Link</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircleIcon className="size-4 shrink-0" />
                <span>
                  Invite link generated successfully! Copy and send it to your
                  collaborator.
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground">
                  Registration URL
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generatedInviteUrl}
                    className="font-mono text-xs select-all"
                  />
                  <CopyButton
                    text={generatedInviteUrl}
                    label="Copy Link"
                    variant="outline"
                    className="shrink-0"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setGeneratedInviteUrl(null)
                    setInviteRole("member")
                  }}
                >
                  Create Another
                </Button>
                <Button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog
        open={Boolean(roleModalUser)}
        onOpenChange={(open) => !open && setRoleModalUser(null)}
      >
        <DialogContent size="sm">
          <form onSubmit={handleUpdateRole} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Change User Role</DialogTitle>
              <DialogDescription>
                Update workspace permissions for {roleModalUser?.name}.
              </DialogDescription>
            </DialogHeader>

            {roleError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                <WarningIcon className="size-4 shrink-0" />
                <span>{roleError}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30">
                <input
                  type="radio"
                  name="user-role"
                  value="member"
                  checked={selectedRole === "member"}
                  onChange={() => setSelectedRole("member")}
                  className="size-4 text-primary"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    Member
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Deployments, services, logs, and project configuration.
                  </span>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30">
                <input
                  type="radio"
                  name="user-role"
                  value="admin"
                  checked={selectedRole === "admin"}
                  onChange={() => setSelectedRole("admin")}
                  className="size-4 text-primary"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    Admin
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Full cluster access including server nodes and collaborator
                    management.
                  </span>
                </div>
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRoleModalUser(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdatingRole}>
                {isUpdatingRole ? (
                  <>
                    <CircleNotchIcon className="size-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Update Role</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => !open && setDeletingUser(null)}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Remove Collaborator</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {deletingUser?.name} (
              {deletingUser?.email})? All active sessions for this account will
              be terminated immediately.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <WarningIcon className="size-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingUser(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeletingUser}
              onClick={handleDeleteUser}
            >
              {isDeletingUser ? (
                <>
                  <CircleNotchIcon className="size-4 animate-spin" />
                  <span>Removing...</span>
                </>
              ) : (
                <span>Remove User</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
