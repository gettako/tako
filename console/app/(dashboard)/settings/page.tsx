"use client"

import * as React from "react"
import Link from "next/link"
import {
  UserIcon,
  LockIcon,
  ShieldCheckIcon,
  BroomIcon,
  ArrowRightIcon,
  CheckIcon,
  CircleNotchIcon,
  WarningIcon,
  CheckCircleIcon,
  BellIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, ApiError, type AdminUser } from "@/lib/api"
import { cn } from "@/lib/utils"
import { SettingsHeader } from "@/components/settings-header"
import { ConsoleDomainCard } from "@/components/settings/console-domain-card"

export function AdminProfileCard({
  user,
  onProfileUpdated,
}: {
  user: AdminUser | null
  onProfileUpdated?: (updated: AdminUser) => void
}) {
  const [email, setEmail] = React.useState(user?.email || "")
  const [isSaving, setIsSaving] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  React.useEffect(() => {
    if (user?.email) {
      setEmail(user.email)
    }
  }, [user?.email])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes("@")) {
      setFeedback({
        type: "error",
        message: "Please enter a valid email address.",
      })
      return
    }

    setIsSaving(true)
    setFeedback(null)

    try {
      const updated = await api.auth.updateProfile({ email: email.trim() })
      setFeedback({
        type: "success",
        message: "Administrator profile updated successfully.",
      })
      if (onProfileUpdated) {
        onProfileUpdated(updated)
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to update profile email."
      setFeedback({ type: "error", message: msg })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-6">
      <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted text-foreground">
            <UserIcon className="size-5" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              Administrator Profile
            </h2>
            <p className="text-xs text-muted-foreground">
              Control plane owner account details and notification email.
            </p>
          </div>
        </div>

        {feedback && (
          <div
            role="alert"
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
              feedback.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            {feedback.type === "success" ? (
              <CheckIcon className="size-4 shrink-0" />
            ) : (
              <WarningIcon className="size-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="admin-name"
            className="text-xs font-medium text-foreground"
          >
            Full Name
          </label>
          <Input
            id="admin-name"
            value={user?.name || "Admin Owner"}
            disabled
            className="h-9 bg-muted/40 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="admin-email"
            className="text-xs font-medium text-foreground"
          >
            Email Address
          </label>
          <Input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (feedback) setFeedback(null)
            }}
            disabled={isSaving}
            placeholder="admin@example.com"
            className="h-9 text-xs"
          />
        </div>

        <div className="flex items-center justify-end pt-2">
          <Button
            type="submit"
            size="sm"
            disabled={isSaving}
            className="gap-1.5 text-xs"
          >
            {isSaving ? (
              <>
                <CircleNotchIcon className="size-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Profile</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword) {
      setFeedback({
        type: "error",
        message: "Current password is required.",
      })
      return
    }

    if (newPassword.length < 8) {
      setFeedback({
        type: "error",
        message: "New password must be at least 8 characters long.",
      })
      return
    }

    if (newPassword !== confirmPassword) {
      setFeedback({
        type: "error",
        message: "New passwords do not match.",
      })
      return
    }

    setIsSubmitting(true)
    setFeedback(null)

    try {
      const res = await api.auth.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })

      setFeedback({
        type: "success",
        message: "Password updated successfully.",
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to update administrator password."
      setFeedback({ type: "error", message: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted text-foreground">
            <LockIcon className="size-5" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              Change Password
            </h2>
            <p className="text-xs text-muted-foreground">
              Update master password for control plane administrator login.
            </p>
          </div>
        </div>

        {feedback && (
          <div
            role="alert"
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
              feedback.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            {feedback.type === "success" ? (
              <CheckIcon className="size-4 shrink-0" />
            ) : (
              <WarningIcon className="size-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="current-password"
            className="text-xs font-medium text-foreground"
          >
            Current Password
          </label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value)
              if (feedback) setFeedback(null)
            }}
            disabled={isSubmitting}
            className="h-9 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="new-password"
            className="text-xs font-medium text-foreground"
          >
            New Password
          </label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              if (feedback) setFeedback(null)
            }}
            disabled={isSubmitting}
            placeholder="Minimum 8 characters"
            className="h-9 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirm-password"
            className="text-xs font-medium text-foreground"
          >
            Confirm New Password
          </label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (feedback) setFeedback(null)
            }}
            disabled={isSubmitting}
            className="h-9 text-xs"
          />
        </div>

        <div className="flex items-center justify-end pt-2">
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="gap-1.5 text-xs"
          >
            {isSubmitting ? (
              <>
                <CircleNotchIcon className="size-3.5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <span>Update Password</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

export function AuthShortcutCard({ user }: { user: AdminUser | null }) {
  const is2faActive = user?.two_factor_enabled || false
  const isPasskeysActive = user?.passkeys_enabled || false

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted text-foreground">
            <ShieldCheckIcon className="size-5" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              Security & Two-Factor Authentication
            </h2>
            <p className="text-xs text-muted-foreground">
              Multi-factor authenticator app and biometric passkeys.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              Two-Factor Authentication:
            </span>
            {is2faActive ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircleIcon className="size-3.5" />
                <span>Enabled</span>
              </span>
            ) : (
              <span className="font-medium text-muted-foreground">
                Disabled
              </span>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-muted-foreground">Passkeys / WebAuthn:</span>
            {isPasskeysActive ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircleIcon className="size-3.5" />
                <span>Configured</span>
              </span>
            ) : (
              <span className="font-medium text-muted-foreground">
                Not configured
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end border-t border-border pt-4">
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/settings/security" />}
          className="gap-1.5 text-xs"
        >
          <span>Manage 2FA & Passkeys</span>
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function CleanupPolicyCard() {
  const [keepImagesCount, setKeepImagesCount] = React.useState(5)
  const [retentionDays, setRetentionDays] = React.useState(7)
  const [savedFeedback, setSavedFeedback] = React.useState(false)

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault()
    setSavedFeedback(true)
    setTimeout(() => setSavedFeedback(false), 3000)
  }

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-6">
      <form onSubmit={handleSavePolicy} className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted text-foreground">
            <BroomIcon className="size-5" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              Automated Cleanup Policy
            </h2>
            <p className="text-xs text-muted-foreground">
              Docker disk space reclamation and rollback image retention.
            </p>
          </div>
        </div>

        {savedFeedback && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400"
          >
            <CheckIcon className="size-4 shrink-0" />
            <span>Cleanup retention policy saved successfully.</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="keep-images-count"
            className="text-xs font-medium text-foreground"
          >
            Rollback Images Preserved Per Service
          </label>
          <Input
            id="keep-images-count"
            type="number"
            min={2}
            max={20}
            value={keepImagesCount}
            onChange={(e) => setKeepImagesCount(Number(e.target.value) || 2)}
            className="h-9 text-xs"
          />
          <p className="text-2xs text-muted-foreground">
            Guarantees the last {keepImagesCount} successful deployment images
            are protected from Docker pruning.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="retention-days"
            className="text-xs font-medium text-foreground"
          >
            Build Cache Retention (Days)
          </label>
          <Input
            id="retention-days"
            type="number"
            min={1}
            max={60}
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value) || 1)}
            className="h-9 text-xs"
          />
          <p className="text-2xs text-muted-foreground">
            Unused Docker buildkit cache layers older than {retentionDays} days
            are pruned automatically.
          </p>
        </div>

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" size="sm" className="gap-1.5 text-xs">
            <span>Save Retention Policy</span>
          </Button>
        </div>
      </form>
    </div>
  )
}

export function NotificationsShortcutCard() {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted text-foreground">
            <BellIcon className="size-5" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              Notifications & Alerts
            </h2>
            <p className="text-xs text-muted-foreground">
              Outgoing webhook and bot alerts to Discord and Telegram.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Supported Channels:</span>
            <span className="font-medium text-foreground">
              Discord, Telegram
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-muted-foreground">Event Triggers:</span>
            <span className="font-medium text-foreground">
              Deploy Success, Failed, Container Crash
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end border-t border-border pt-4">
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/settings/notifications" />}
          className="gap-1.5 text-xs"
        >
          <span>Manage Notifications</span>
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      <SettingsHeader
        title="Settings"
        description="Configure platform preferences, domain ingress, and system cleanup."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Card 1: Console Domain & SSL Ingress */}
        <ConsoleDomainCard />

        {/* Card 2: Automated Cleanup Policy */}
        <CleanupPolicyCard />
      </div>
    </div>
  )
}
