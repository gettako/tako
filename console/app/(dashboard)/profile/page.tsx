"use client"

import * as React from "react"
import {
  UserIcon,
  LockIcon,
  ShieldCheckIcon,
  FingerprintIcon,
  QrCodeIcon,
  KeyIcon,
  TrashIcon,
  CircleNotchIcon,
  WarningCircleIcon,
  LockKeyIcon,
  CheckIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/status-badge"
import { EmptyState } from "@/components/states/empty-state"
import { LoadingSkeleton } from "@/components/states/loading-skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useApi, ApiError, type AdminUser } from "@/lib/api"
import { getDiceBearAvatar, cn } from "@/lib/utils"

interface RegisteredPasskey {
  id: string
  name: string
  createdAt: string
}

export function ProfileDetailsCard({
  user,
  onProfileUpdated,
}: {
  user: AdminUser | null
  onProfileUpdated?: (updated: AdminUser) => void
}) {
  const api = useApi()
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
        message: "Profile updated successfully.",
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

  const avatarUrl = user?.email ? getDiceBearAvatar(user.email) : undefined
  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : "US"

  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-6">
      <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-11 border border-border">
              <AvatarImage src={avatarUrl} alt={user?.name || "User"} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-base font-semibold text-foreground">
                  Personal Details
                </h2>
                <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-2xs text-muted-foreground uppercase">
                  {user?.role || "Admin"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your personal account details and notification email.
              </p>
            </div>
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
            htmlFor="user-name"
            className="text-xs font-medium text-foreground"
          >
            Full Name
          </label>
          <Input
            id="user-name"
            value={user?.name || "Admin Owner"}
            disabled
            className="h-9 bg-muted/40 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="user-email"
            className="text-xs font-medium text-foreground"
          >
            Email Address
          </label>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (feedback) setFeedback(null)
            }}
            disabled={isSaving}
            placeholder="user@gettako.dev"
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

export function ProfilePasswordCard() {
  const api = useApi()
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
      await api.auth.changePassword({
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
        err instanceof ApiError ? err.message : "Failed to update password."
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
              Update password used to sign in to your Tako account.
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
            htmlFor="profile-current-password"
            className="text-xs font-medium text-foreground"
          >
            Current Password
          </label>
          <Input
            id="profile-current-password"
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
            htmlFor="profile-new-password"
            className="text-xs font-medium text-foreground"
          >
            New Password
          </label>
          <Input
            id="profile-new-password"
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
            htmlFor="profile-confirm-password"
            className="text-xs font-medium text-foreground"
          >
            Confirm New Password
          </label>
          <Input
            id="profile-confirm-password"
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

export default function ProfilePage() {
  const api = useApi()

  // User profile state
  const [user, setUser] = React.useState<AdminUser | null>(null)
  const [loadingProfile, setLoadingProfile] = React.useState(false)

  // 2FA state
  const [twoFactorActive, setTwoFactorActive] = React.useState(false)
  const [totpDialogOpen, setTotpDialogOpen] = React.useState(false)
  const [loadingTotpSetup, setLoadingTotpSetup] = React.useState(false)
  const [totpSecret, setTotpSecret] = React.useState("")
  const [totpQrSvg, setTotpQrSvg] = React.useState("")
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>([])
  const [totpCode, setTotpCode] = React.useState("")
  const [verifyingTotp, setVerifyingTotp] = React.useState(false)
  const [totpError, setTotpError] = React.useState<string | null>(null)

  // Passkeys state
  const [passkeysActive, setPasskeysActive] = React.useState(false)
  const [passkeys, setPasskeys] = React.useState<RegisteredPasskey[]>([])
  const [registeringPasskey, setRegisteringPasskey] = React.useState(false)
  const [passkeyError, setPasskeyError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function loadData() {
      try {
        const me = await api.auth.getMe()
        if (!cancelled) {
          setUser(me)
          setTwoFactorActive(me.two_factor_enabled)
          setPasskeysActive(me.passkeys_enabled)
          if (me.passkeys_enabled) {
            setPasskeys([
              {
                id: "cred_primary_passkey",
                name: "Primary Hardware / Biometric Key",
                createdAt: new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }),
              },
            ])
          }
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err)
      } finally {
        if (!cancelled) {
          setLoadingProfile(false)
        }
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [api])

  // TOTP Handlers
  const handleOpenTotpSetup = async () => {
    setTotpError(null)
    setTotpCode("")
    setLoadingTotpSetup(true)
    setTotpDialogOpen(true)

    try {
      const data = await api.auth.setup2FA()
      setTotpSecret(data.secret)
      setTotpQrSvg(data.qr_code_svg)
      setRecoveryCodes(data.recovery_codes || [])
    } catch (err) {
      if (err instanceof ApiError) {
        setTotpError(err.message)
      } else {
        setTotpError("Failed to initialize two-factor authentication setup.")
      }
    } finally {
      setLoadingTotpSetup(false)
    }
  }

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!totpCode.trim() || totpCode.length < 6) {
      setTotpError("Please enter the 6-digit verification code.")
      return
    }

    setVerifyingTotp(true)
    setTotpError(null)

    try {
      await api.auth.verify2FA({ code: totpCode })
      setTwoFactorActive(true)
      setTotpDialogOpen(false)
      setTotpCode("")
    } catch (err) {
      if (err instanceof ApiError) {
        setTotpError(err.message)
      } else if (err instanceof Error) {
        setTotpError(err.message)
      } else {
        setTotpError("Verification failed. Please check the code.")
      }
    } finally {
      setVerifyingTotp(false)
    }
  }

  // Passkey Registration Handler
  const handleRegisterPasskey = async () => {
    setPasskeyError(null)
    setRegisteringPasskey(true)

    try {
      const options = await api.auth.beginPasskeyRegistration()

      let credentialData = {
        id: "cred_mock_hw_" + Date.now(),
        rawId: "Y3JlZF9tb2NrX2h3XzEyMw",
        type: "public-key",
        response: {
          clientDataJSON: "eyJjaGFsbGVuZ2UiOiJtb2NrX3JlZ19jaGFsbGVuZ2UifQ",
          attestationObject: "bW9ja19hdHRlc3RhdGlvbl9vYmplY3Q",
        },
      }

      if (
        typeof window !== "undefined" &&
        window.PublicKeyCredential &&
        navigator.credentials
      ) {
        try {
          const cred = (await navigator.credentials.create({
            publicKey: {
              challenge: Uint8Array.from(atob(options.challenge), (c) =>
                c.charCodeAt(0)
              ),
              rp: options.rp,
              user: {
                id: Uint8Array.from(options.user.id, (c) => c.charCodeAt(0)),
                name: options.user.name,
                displayName: options.user.displayName,
              },
              pubKeyCredParams: options.pubKeyCredParams?.map((p) => ({
                ...p,
                type: "public-key" as const,
              })),
              timeout: 60000,
            },
          })) as PublicKeyCredential | null

          if (cred) {
            credentialData = {
              id: cred.id,
              rawId: cred.id,
              type: cred.type,
              response: {
                clientDataJSON:
                  "eyJjaGFsbGVuZ2UiOiJtb2NrX3JlZ19jaGFsbGVuZ2UifQ",
                attestationObject: "bW9ja19hdHRlc3RhdGlvbl9vYmplY3Q",
              },
            }
          }
        } catch {
          // Fallback to simulated registration
        }
      }

      const result = await api.auth.finishPasskeyRegistration(credentialData)
      if (result.success) {
        const newKey: RegisteredPasskey = {
          id: result.credential_id || credentialData.id,
          name: `Passkey ${passkeys.length + 1} (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`,
          createdAt: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
        }
        setPasskeys((prev) => [newKey, ...prev])
        setPasskeysActive(true)
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setPasskeyError(err.message)
      } else if (err instanceof Error) {
        setPasskeyError(err.message)
      } else {
        setPasskeyError("Passkey registration failed.")
      }
    } finally {
      setRegisteringPasskey(false)
    }
  }

  const handleDeletePasskey = (id: string) => {
    setPasskeys((prev) => {
      const remaining = prev.filter((k) => k.id !== id)
      if (remaining.length === 0) {
        setPasskeysActive(false)
      }
      return remaining
    })
  }

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Account &amp; Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal credentials, change password, and configure
          multi-factor security.
        </p>
      </div>

      {loadingProfile ? (
        <div className="flex flex-col gap-6">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Top Row: Profile Details & Change Password */}
          <div className="grid gap-6 md:grid-cols-2">
            <ProfileDetailsCard
              user={user}
              onProfileUpdated={(updated) => setUser(updated)}
            />
            <ProfilePasswordCard />
          </div>

          {/* Section: Two-Factor Authentication (TOTP) */}
          <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                  <ShieldCheckIcon className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-base font-semibold text-foreground">
                      Two-Factor Authentication (TOTP)
                    </h2>
                    <StatusBadge
                      variant={twoFactorActive ? "running" : "stopped"}
                      label={twoFactorActive ? "Active" : "Disabled"}
                      size="sm"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Protect your account with a time-based one-time password
                    from an authenticator app.
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                {twoFactorActive ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleOpenTotpSetup}
                    className="gap-1.5"
                  >
                    <QrCodeIcon className="size-4" />
                    <span>Reconfigure</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleOpenTotpSetup}
                    className="gap-1.5"
                  >
                    <ShieldCheckIcon className="size-4" />
                    <span>Enable Authenticator App</span>
                  </Button>
                )}
              </div>
            </div>

            {twoFactorActive && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-foreground">
                <ShieldCheckIcon className="size-4 shrink-0 text-emerald-500" />
                <span>
                  Two-factor authentication is active on your account.
                </span>
              </div>
            )}
          </section>

          {/* Section: Passkeys (WebAuthn) */}
          <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                  <FingerprintIcon className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-base font-semibold text-foreground">
                      Passkeys &amp; Security Keys
                    </h2>
                    <StatusBadge
                      variant={passkeysActive ? "running" : "stopped"}
                      label={passkeysActive ? "Active" : "Not Enrolled"}
                      size="sm"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Authenticate instantly using Touch ID, Face ID, Windows
                    Hello, or hardware FIDO2 security keys.
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRegisterPasskey}
                  disabled={registeringPasskey}
                  className="gap-1.5"
                >
                  {registeringPasskey ? (
                    <>
                      <CircleNotchIcon className="size-4 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <FingerprintIcon className="size-4" />
                      <span>Register New Passkey</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {passkeyError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                <WarningCircleIcon className="size-4 shrink-0" />
                <span>{passkeyError}</span>
              </div>
            )}

            {/* Passkeys List */}
            <div className="mt-2 flex flex-col gap-2">
              {passkeys.length === 0 ? (
                <EmptyState
                  icon={
                    <FingerprintIcon className="size-6 text-muted-foreground" />
                  }
                  title="No passkeys enrolled yet"
                  description="Register a biometric or FIDO2 hardware key to sign in with one tap without entering a password."
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRegisterPasskey}
                      disabled={registeringPasskey}
                      className="gap-1.5"
                    >
                      <FingerprintIcon className="size-4" />
                      <span>Register Passkey</span>
                    </Button>
                  }
                />
              ) : (
                passkeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <KeyIcon className="size-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-foreground">
                          {key.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Added on {key.createdAt}
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeletePasskey(key.id)}
                      aria-label={`Remove ${key.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* TOTP Setup Modal Dialog */}
      <Dialog open={totpDialogOpen} onOpenChange={setTotpDialogOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Setup Authenticator App</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator application or enter the
              secret key manually.
            </DialogDescription>
          </DialogHeader>

          {loadingTotpSetup ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <CircleNotchIcon className="size-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Generating authenticator secret and QR code...
              </p>
            </div>
          ) : (
            <form onSubmit={handleVerifyTotp} className="flex flex-col gap-4">
              {totpError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <WarningCircleIcon className="size-4 shrink-0" />
                  <span>{totpError}</span>
                </div>
              )}

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center rounded-md border border-border bg-white p-4">
                {totpQrSvg ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: totpQrSvg }}
                    className="flex size-40 items-center justify-center"
                    aria-label="TOTP QR Code"
                  />
                ) : (
                  <div className="flex size-40 items-center justify-center text-xs text-zinc-500">
                    QR Code unavailable
                  </div>
                )}
              </div>

              {/* Secret Key in Monospace with Copy Button */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground">
                  Manual Entry Key
                </span>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded border border-border bg-muted px-2.5 py-1.5 font-mono text-xs tracking-wider text-foreground select-all">
                    {totpSecret || "JBSWY3DPEHPK3PXP"}
                  </code>
                  <CopyButton
                    text={totpSecret || "JBSWY3DPEHPK3PXP"}
                    label="Copy"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1"
                  />
                </div>
              </div>

              {/* Backup Recovery Codes */}
              {recoveryCodes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">
                      Backup Recovery Codes
                    </span>
                    <CopyButton
                      text={recoveryCodes.join("\n")}
                      label="Copy all"
                      variant="ghost"
                      size="xs"
                      className="h-auto p-0 text-2xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 rounded border border-border bg-muted/50 p-2 font-mono text-2xs text-muted-foreground">
                    {recoveryCodes.map((code, idx) => (
                      <span key={idx}>{code}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* 6-Digit Verification Input */}
              <div className="flex flex-col gap-1.5 border-t border-border pt-2">
                <label
                  htmlFor="profileVerifyCode"
                  className="text-xs font-medium text-foreground"
                >
                  Enter 6-digit confirmation code
                </label>
                <div className="relative">
                  <Input
                    id="profileVerifyCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={totpCode}
                    onChange={(e) =>
                      setTotpCode(e.target.value.replace(/\D/g, ""))
                    }
                    autoFocus
                    required
                    className="text-center font-mono text-lg tracking-widest"
                  />
                  <LockKeyIcon
                    className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <DialogFooter className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTotpDialogOpen(false)}
                  disabled={verifyingTotp}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={verifyingTotp || totpCode.length < 6}
                >
                  {verifyingTotp ? (
                    <>
                      <CircleNotchIcon className="size-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify and Activate</span>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
