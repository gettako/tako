"use client"

import * as React from "react"
import {
  Check,
  CheckCircle2,
  Copy,
  Mail,
  Shield,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react"
import { z } from "zod"

import { SettingsSectionHeader } from "@/components/settings/settings-section-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  SelectOption,
} from "@/components/ui/searchable-select"
import { usePlatformData } from "@/context/platform-data-context"
import { useZodForm } from "@/hooks/use-zod-form"
import { copyToClipboard } from "@/lib/clipboard"
import { getInitials } from "@/lib/user"
import { PlatformUser, PlatformUserInvite, UserRole } from "@/types/platform"

const inviteSchema = z.object({
  inviteEmail: z
    .string()
    .trim()
    .min(1, "Email address is required.")
    .email("Enter a valid email address."),
  inviteRole: z.enum(["admin", "member"]),
  inviteExpiryDays: z
    .number()
    .int()
    .refine(
      (value) => [1, 7, 30].includes(value),
      "Select a valid expiration period."
    ),
})

const TABLE_ROLE_OPTIONS: SelectOption[] = [
  {
    value: "admin",
    label: "Admin",
    badge: "ROOT",
    description: "Full cluster administration & privileges",
  },
  {
    value: "member",
    label: "Member",
    badge: "DEV",
    description: "Read metrics & trigger service deployments",
  },
]

const INVITE_ROLE_OPTIONS: SelectOption[] = [
  {
    value: "member",
    label: "Member (Read & Deploy)",
    badge: "DEV",
    description: "Can deploy branch containers and view operational telemetry",
  },
  {
    value: "admin",
    label: "Admin (Full Control)",
    badge: "ROOT",
    description:
      "Full control over nodes, secrets, storage, and cluster configuration",
  },
]

const INVITE_EXPIRY_OPTIONS: SelectOption[] = [
  {
    value: "1",
    label: "24 Hours",
    description: "Invitation link expires in 1 day",
  },
  {
    value: "7",
    label: "7 Days",
    description: "Standard expiration period (1 week)",
  },
  {
    value: "30",
    label: "30 Days",
    description: "Extended link validity period (1 month)",
  },
]

export function UsersPanel() {
  const {
    users,
    invites,
    addUserInvite,
    revokeUserInvite,
    updateUserRole,
    deleteUser,
  } = usePlatformData()

  const [inviteModalOpen, setInviteModalOpen] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteRole, setInviteRole] = React.useState<"admin" | "member">(
    "member"
  )
  const [inviteExpiryDays, setInviteExpiryDays] = React.useState(7)
  const { errors, validate, clearError, setErrors } = useZodForm(inviteSchema)
  const [generatedInvite, setGeneratedInvite] =
    React.useState<PlatformUserInvite | null>(null)
  const [copiedTokenId, setCopiedTokenId] = React.useState<string | null>(null)

  // Deactivate user modal state
  const [userToDelete, setUserToDelete] = React.useState<PlatformUser | null>(
    null
  )

  const handleOpenInvite = () => {
    setInviteEmail("")
    setInviteRole("member")
    setInviteExpiryDays(7)
    setErrors({})
    setGeneratedInvite(null)
    setInviteModalOpen(true)
  }

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !validate({
        inviteEmail,
        inviteRole,
        inviteExpiryDays,
      })
    ) {
      return
    }

    const newInv = await addUserInvite(
      inviteEmail.trim(),
      inviteRole,
      inviteExpiryDays
    )
    setGeneratedInvite(newInv)
  }

  const getInviteUrl = (token: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/invite?token=${token}`
    }
    return `https://console.gettako.dev/invite?token=${token}`
  }

  const handleCopyLink = async (id: string, token: string) => {
    if (await copyToClipboard(getInviteUrl(token))) {
      setCopiedTokenId(id)
      setTimeout(() => setCopiedTokenId(null), 2000)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Team Members List Card */}
      <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
        <SettingsSectionHeader
          icon={Users}
          title="Team Members & Permissions"
          description="Manage operators who can deploy services, configure cluster settings, and inspect node telemetry."
          action={
            <Button
              type="button"
              size="sm"
              onClick={handleOpenInvite}
              className="gap-1.5 text-xs"
            >
              <UserPlus className="size-3.5" />
              <span>Invite Member</span>
            </Button>
          }
        />

        {/* Members Table */}
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-mono text-[11px] text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Operator</th>
                  <th className="px-4 py-3 font-semibold">Assigned Role</th>
                  <th className="px-4 py-3 font-semibold">2FA Security</th>
                  <th className="px-4 py-3 font-semibold">Joined Date</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => {
                  const isOwner = user.role === "owner"
                  return (
                    <tr
                      key={user.id}
                      className="transition-colors hover:bg-muted/20"
                    >
                      <td
                        className="px-4 py-3"
                        aria-label={`Operator ${user.name}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted font-mono text-xs font-semibold text-foreground">
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <span className="block font-semibold text-foreground">
                              {user.name}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {isOwner ? (
                          <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary uppercase">
                            <Shield className="size-3" />
                            Owner
                          </span>
                        ) : (
                          <SearchableSelect
                            size="sm"
                            className="w-32"
                            aria-label="Assigned Role"
                            value={user.role}
                            onChange={(val) =>
                              updateUserRole(user.id, val as UserRole)
                            }
                            options={TABLE_ROLE_OPTIONS}
                            searchPlaceholder="Filter role..."
                          />
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {user.twoFactorEnabled ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-500">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            <span>2FA Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-muted-foreground" />
                            <span>Not Configured</span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                        {user.createdAt}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {!isOwner && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setUserToDelete(user)}
                            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Deactivate Operator"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. Active Invites Table */}
      {invites.length > 0 && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
          <SettingsSectionHeader
            icon={Mail}
            title="Pending Invite Links"
            description="Single-use invitation URLs waiting to be accepted by prospective cluster operators."
          />

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-mono text-[11px] text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">
                      Recipient Email
                    </th>
                    <th className="px-4 py-2.5 font-semibold">Role</th>
                    <th className="px-4 py-2.5 font-semibold">Expires</th>
                    <th className="px-4 py-2.5 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-xs">
                  {invites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {inv.email}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground uppercase">
                          {inv.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground">
                        {inv.expiresAt}
                      </td>
                      <td className="px-4 py-3 text-right" aria-label="Actions">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => handleCopyLink(inv.id, inv.token)}
                            className="gap-1 text-[11px]"
                          >
                            {copiedTokenId === inv.id ? (
                              <>
                                <Check className="size-3 text-emerald-500" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => revokeUserInvite(inv.id)}
                            className="text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            Revoke
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Dialog */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 shrink-0 text-primary" />
              <span>Invite Team Member</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generate a secure, single-use invite URL to grant cluster access
              to an operator.
            </DialogDescription>
          </DialogHeader>

          {generatedInvite ? (
            <div className="space-y-4 py-2 text-xs">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 font-medium text-emerald-500">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  Invitation link generated for {generatedInvite.email}!
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-muted-foreground">
                  Shareable Invite Link
                </span>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={getInviteUrl(generatedInvite.token)}
                    className="bg-muted/40 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyLink("gen", generatedInvite.token)}
                    className="shrink-0 gap-1.5 text-xs"
                  >
                    {copiedTokenId === "gen" ? (
                      <>
                        <Check className="size-3.5 text-emerald-500" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setInviteModalOpen(false)}
                  className="w-full text-xs"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              onSubmit={handleGenerateInvite}
              noValidate
              className="space-y-4 py-2"
            >
              <FieldGroup className="gap-4">
                <Field data-invalid={Boolean(errors.inviteEmail)}>
                  <FieldLabel className="text-xs">Email Address</FieldLabel>
                  <Input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value)
                      clearError("inviteEmail")
                    }}
                    aria-invalid={Boolean(errors.inviteEmail)}
                    aria-describedby={
                      errors.inviteEmail ? "invite-email-error" : undefined
                    }
                    className="text-xs"
                  />
                  <FieldError id="invite-email-error" className="text-[11px]">
                    {errors.inviteEmail}
                  </FieldError>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field data-invalid={Boolean(errors.inviteRole)}>
                    <FieldLabel className="text-xs">Assigned Role</FieldLabel>
                    <SearchableSelect
                      value={inviteRole}
                      onChange={(val) => {
                        setInviteRole(val as "admin" | "member")
                        clearError("inviteRole")
                      }}
                      options={INVITE_ROLE_OPTIONS}
                      searchPlaceholder="Search role..."
                    />
                    <FieldError id="invite-role-error" className="text-[11px]">
                      {errors.inviteRole}
                    </FieldError>
                  </Field>

                  <Field data-invalid={Boolean(errors.inviteExpiryDays)}>
                    <FieldLabel className="text-xs">Link Expiration</FieldLabel>
                    <SearchableSelect
                      value={String(inviteExpiryDays)}
                      onChange={(val) => {
                        setInviteExpiryDays(Number(val))
                        clearError("inviteExpiryDays")
                      }}
                      options={INVITE_EXPIRY_OPTIONS}
                      searchPlaceholder="Search expiration..."
                    />
                    <FieldError
                      id="invite-expiry-error"
                      className="text-[11px]"
                    >
                      {errors.inviteExpiryDays}
                    </FieldError>
                  </Field>
                </div>
              </FieldGroup>

              <DialogFooter className="gap-2 pt-2 sm:gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInviteModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="gap-1.5 text-xs">
                  <UserCheck className="size-3.5" />
                  <span>Generate Invite Link</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Deactivate User Confirmation Dialog */}
      <Dialog
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <span>Deactivate Team Member</span>
            </DialogTitle>
            <DialogDescription className="pt-1 text-xs leading-relaxed">
              Are you sure you want to remove{" "}
              <strong className="text-foreground">{userToDelete?.name}</strong>{" "}
              ({userToDelete?.email}) from the cluster? They will immediately
              lose access to deployment pipelines and gRPC telemetry streams.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUserToDelete(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (userToDelete) {
                  deleteUser(userToDelete.id)
                  setUserToDelete(null)
                }
              }}
              className="gap-1.5 text-xs"
            >
              <Trash2 className="size-3.5" />
              <span>Confirm Deactivation</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
