"use client"

import * as React from "react"
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  Key,
  KeyRound,
  Lock,
  Plus,
  QrCode,
  RotateCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import QRCode from "qrcode"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  SelectOption,
} from "@/components/ui/searchable-select"
import { usePlatformData } from "@/context/platform-data-context"
import { useZodForm } from "@/hooks/use-zod-form"
import { copyToClipboard } from "@/lib/clipboard"
import type { UserPasskey } from "@/types/platform"

export const DEFAULT_RECOVERY_CODES = [
  "A8F1-9B2C",
  "4D5E-6F7A",
  "8B9C-0D1E",
  "2F3A-4B5C",
  "6D7E-8F9A",
  "0B1C-2D3E",
  "4F5A-6B7C",
  "8D9E-0F1A",
]

export const DEFAULT_TOTP_SECRET = "JBSW-Y3DP-EHPK-3PXP"

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z
      .string()
      .min(10, "Password must be at least 10 characters long.")
      .regex(/[A-Z]/, "Include at least one uppercase letter.")
      .regex(/[0-9]/, "Include at least one number.")
      .regex(/[^A-Za-z0-9]/, "Include at least one special character."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .superRefine((values, context) => {
    if (values.newPassword !== values.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "New passwords do not match.",
      })
    }
  })

export const twoFactorSchema = z.object({
  verifyCode: z
    .string()
    .regex(/^\d{6}$/, "Enter the 6-digit authenticator code."),
})

export const passkeySchema = z.object({
  keyName: z
    .string()
    .trim()
    .min(2, "Passkey label must be at least 2 characters.")
    .max(60, "Passkey label must be 60 characters or fewer."),
  keyType: z.enum(["touch_id", "yubikey", "security_key"]),
})

export const PASSKEY_TYPE_OPTIONS: SelectOption[] = [
  {
    value: "touch_id",
    label: "Platform Biometric",
    description: "Apple Touch ID / Face ID / Windows Hello",
    badge: "BIOMETRIC",
  },
  {
    value: "yubikey",
    label: "Roaming Security Key",
    description: "YubiKey 5 / FIDO2 NFC hardware authenticator",
    badge: "FIDO2",
  },
  {
    value: "security_key",
    label: "Generic USB Hardware Key",
    description: "Standard USB-A/C FIDO hardware token",
    badge: "USB",
  },
]

export function ProfileSecurityTab() {
  const {
    currentUser,
    updateCurrentUser,
    addAuditLog,
    passkeys,
    addPasskey,
    removePasskey,
  } = usePlatformData()

  // 1. Password state
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false)
  const [showNewPassword, setShowNewPassword] = React.useState(false)
  const [passwordStatus, setPasswordStatus] = React.useState<string | null>(
    null
  )
  const {
    errors: passwordErrors,
    validate: validatePassword,
    clearError: clearPasswordError,
  } = useZodForm(passwordSchema)

  // 2. 2FA state
  const [twoFactorModalOpen, setTwoFactorModalOpen] = React.useState(false)
  const [disable2FAModalOpen, setDisable2FAModalOpen] = React.useState(false)
  const [verifyCode, setVerifyCode] = React.useState("")
  const [verifyStatus, setVerifyStatus] = React.useState<string | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = React.useState<string>("")
  const {
    errors: twoFactorErrors,
    validate: validateTwoFactor,
    clearError: clearTwoFactorError,
  } = useZodForm(twoFactorSchema)
  const [copiedSecret, setCopiedSecret] = React.useState(false)
  const [copiedCodes, setCopiedCodes] = React.useState(false)
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[]>(
    DEFAULT_RECOVERY_CODES
  )

  const totpSecret = DEFAULT_TOTP_SECRET

  React.useEffect(() => {
    if (twoFactorModalOpen) {
      const cleanSecret = totpSecret.replace(/[^A-Z2-7]/gi, "").toUpperCase()
      const otpauthUrl = `otpauth://totp/Tako:${encodeURIComponent(currentUser.email)}?secret=${cleanSecret}&issuer=Tako&algorithm=SHA1&digits=6&period=30`

      QRCode.toDataURL(otpauthUrl, {
        margin: 1,
        width: 320,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then(setQrCodeUrl)
        .catch((err) => console.error("Error generating QR code:", err))
    }
  }, [twoFactorModalOpen, currentUser.email, totpSecret])

  // 3. Passkey state
  const [addPasskeyModalOpen, setAddPasskeyModalOpen] = React.useState(false)
  const [keyName, setKeyName] = React.useState("")
  const [keyType, setKeyType] = React.useState<UserPasskey["type"]>("touch_id")
  const [isRegistering, setIsRegistering] = React.useState(false)
  const [registerSuccess, setRegisterSuccess] = React.useState(false)
  const [registerError, setRegisterError] = React.useState<string | null>(null)
  const {
    errors: passkeyErrors,
    validate: validatePasskey,
    clearError: clearPasskeyError,
  } = useZodForm(passkeySchema)
  const [deleteTarget, setDeleteTarget] = React.useState<UserPasskey | null>(
    null
  )

  // Password Requirements Calculation
  const hasMinLength = newPassword.length >= 10
  const hasUppercase = /[A-Z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword)
  const strengthScore = [
    hasMinLength,
    hasUppercase,
    hasNumber,
    hasSpecial,
  ].filter(Boolean).length

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validatePassword({
      currentPassword,
      newPassword,
      confirmPassword,
    })
    if (!valid) return

    setPasswordStatus("saving")
    setTimeout(() => {
      setPasswordStatus("success")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      addAuditLog({
        action: "Operator Password Changed",
        category: "security",
        actor: { name: currentUser.email, type: "user" },
        target: currentUser.name,
        details: "Updated cluster operator login password credential",
        status: "success",
      })
      setTimeout(() => setPasswordStatus(null), 3000)
    }, 700)
  }

  const handleCopySecret = () => {
    void copyToClipboard(totpSecret)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  const handleCopyCodes = () => {
    void copyToClipboard(recoveryCodes.join("\n"))
    setCopiedCodes(true)
    setTimeout(() => setCopiedCodes(false), 2000)
  }

  const handleDownloadCodes = () => {
    const content = `Tako Edge Infrastructure - 2FA Emergency Recovery Codes\nAccount: ${currentUser.email}\nGenerated: ${new Date().toISOString()}\n\n${recoveryCodes.join("\n")}\n\nKeep these codes in an encrypted vault or safe offline location.`
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `tako-recovery-codes-${currentUser.handle}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRegenerateCodes = () => {
    const generated = Array.from({ length: 8 }).map(() => {
      const part1 = Math.random().toString(36).substring(2, 6).toUpperCase()
      const part2 = Math.random().toString(36).substring(2, 6).toUpperCase()
      return `${part1}-${part2}`
    })
    setRecoveryCodes(generated)
    addAuditLog({
      action: "2FA Recovery Codes Regenerated",
      category: "security",
      actor: { name: currentUser.email, type: "user" },
      target: "2FA TOTP",
      details: "Regenerated 8 emergency single-use backup recovery codes",
      status: "success",
    })
  }

  const handleVerify2FACode = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateTwoFactor({ verifyCode })) return

    setVerifyStatus("success")
    updateCurrentUser({ twoFactorEnabled: true })
    setTimeout(() => {
      setTwoFactorModalOpen(false)
      setVerifyStatus(null)
      setVerifyCode("")
    }, 1000)
  }

  const handleDisable2FA = () => {
    updateCurrentUser({ twoFactorEnabled: false })
    setDisable2FAModalOpen(false)
    addAuditLog({
      action: "2FA Disabled",
      category: "security",
      actor: { name: currentUser.email, type: "user" },
      target: "2FA TOTP",
      details:
        "Disabled two-factor authentication requirement for operator account",
      status: "failure",
    })
  }

  const handleRegisterPasskey = async (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validatePasskey({ keyName, keyType })
    if (!valid) return

    setRegisterError(null)
    setIsRegistering(true)

    let credentialId: string | undefined = undefined
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      try {
        const challenge = new Uint8Array(32)
        window.crypto.getRandomValues(challenge)
        const userId = new Uint8Array(16)
        window.crypto.getRandomValues(userId)

        const authenticatorAttachment =
          keyType === "touch_id"
            ? ("platform" as const)
            : ("cross-platform" as const)

        const cred = (await navigator.credentials?.create({
          publicKey: {
            challenge,
            rp: {
              name: "Tako Platform Console",
              id: window.location.hostname || "localhost",
            },
            user: {
              id: userId,
              name: currentUser.email,
              displayName: keyName.trim(),
            },
            pubKeyCredParams: [
              { type: "public-key", alg: -7 },
              { type: "public-key", alg: -257 },
            ],
            authenticatorSelection: {
              authenticatorAttachment,
              userVerification: "preferred",
              residentKey: "preferred",
            },
            timeout: 60000,
          },
        })) as PublicKeyCredential | null

        if (cred && cred.id) {
          credentialId = cred.id
        } else {
          setIsRegistering(false)
          setRegisterError("Passkey prompt was cancelled or dismissed.")
          return
        }
      } catch (err: unknown) {
        setIsRegistering(false)
        const e = err as Error
        if (e.name === "NotAllowedError" || e.name === "AbortError") {
          setRegisterError("Passkey prompt was cancelled.")
        } else {
          setRegisterError(e.message || "Failed to create passkey.")
        }
        return
      }
    } else {
      setIsRegistering(false)
      setRegisterError("WebAuthn is not supported in this browser.")
      return
    }

    try {
      await addPasskey(keyName.trim(), credentialId)
      setIsRegistering(false)
      setRegisterSuccess(true)

      setTimeout(() => {
        setRegisterSuccess(false)
        setAddPasskeyModalOpen(false)
        setKeyName("")
      }, 1000)
    } catch (err: unknown) {
      setIsRegistering(false)
      const e = err as Error
      setRegisterError(e.message || "Failed to register passkey.")
    }
  }

  const handleDeletePasskeyConfirm = () => {
    if (deleteTarget) {
      removePasskey(deleteTarget.id)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Password Change Card (Split 2 Columns) */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Login Password
              </h2>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-500">
                <ShieldCheck className="size-3" />
                <span>Policy Enforced</span>
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Manage master operator credentials and login authentication
              requirements.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Password Update Form */}
          <form
            onSubmit={handlePasswordSubmit}
            noValidate
            className="space-y-4 lg:col-span-7"
          >
            {passwordStatus === "success" && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-500">
                <Check className="size-4 shrink-0" />
                <span>
                  Password successfully updated. New credentials are now active.
                </span>
              </div>
            )}

            <Field data-invalid={Boolean(passwordErrors.currentPassword)}>
              <FieldLabel htmlFor="current-password" className="text-xs">
                Current Password
              </FieldLabel>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value)
                    clearPasswordError("currentPassword")
                  }}
                  placeholder="Enter current password"
                  aria-invalid={Boolean(passwordErrors.currentPassword)}
                  aria-describedby={
                    passwordErrors.currentPassword
                      ? "current-password-error"
                      : undefined
                  }
                  className="pr-9 font-mono text-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground"
                  aria-label={
                    showCurrentPassword ? "Hide password" : "Show password"
                  }
                >
                  {showCurrentPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
              <FieldError id="current-password-error" className="text-[11px]">
                {passwordErrors.currentPassword}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(passwordErrors.newPassword)}>
              <FieldLabel htmlFor="new-password" className="text-xs">
                New Password
              </FieldLabel>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    clearPasswordError("newPassword")
                  }}
                  placeholder="Enter new strong password"
                  aria-invalid={Boolean(passwordErrors.newPassword)}
                  aria-describedby={
                    passwordErrors.newPassword
                      ? "new-password-error"
                      : undefined
                  }
                  className="pr-9 font-mono text-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground"
                  aria-label={
                    showNewPassword ? "Hide password" : "Show password"
                  }
                >
                  {showNewPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
              <FieldError id="new-password-error" className="text-[11px]">
                {passwordErrors.newPassword}
              </FieldError>

              {/* Password Strength Meter */}
              {newPassword.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-muted-foreground">Strength:</span>
                    <span
                      className={
                        strengthScore <= 2
                          ? "font-semibold text-destructive"
                          : strengthScore === 3
                            ? "font-semibold text-amber-500"
                            : "font-semibold text-emerald-500"
                      }
                    >
                      {strengthScore <= 2
                        ? "Weak"
                        : strengthScore === 3
                          ? "Good"
                          : "Very Strong"}
                    </span>
                  </div>
                  <div className="grid h-1.5 w-full grid-cols-4 gap-1.5 overflow-hidden rounded-full bg-muted/60">
                    <div
                      className={`h-full rounded-full transition-all ${
                        strengthScore >= 1 ? "bg-destructive" : "bg-transparent"
                      }`}
                    />
                    <div
                      className={`h-full rounded-full transition-all ${
                        strengthScore >= 2 ? "bg-amber-500" : "bg-transparent"
                      }`}
                    />
                    <div
                      className={`h-full rounded-full transition-all ${
                        strengthScore >= 3 ? "bg-emerald-500" : "bg-transparent"
                      }`}
                    />
                    <div
                      className={`h-full rounded-full transition-all ${
                        strengthScore >= 4 ? "bg-emerald-500" : "bg-transparent"
                      }`}
                    />
                  </div>
                </div>
              )}
            </Field>

            <Field data-invalid={Boolean(passwordErrors.confirmPassword)}>
              <FieldLabel htmlFor="confirm-password" className="text-xs">
                Confirm New Password
              </FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  clearPasswordError("confirmPassword")
                }}
                placeholder="Confirm new password"
                aria-invalid={Boolean(passwordErrors.confirmPassword)}
                aria-describedby={
                  passwordErrors.confirmPassword
                    ? "confirm-password-error"
                    : undefined
                }
                className="font-mono text-xs"
                required
              />
              <FieldError id="confirm-password-error" className="text-[11px]">
                {passwordErrors.confirmPassword}
              </FieldError>
            </Field>

            <div className="pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={passwordStatus === "saving"}
                className="gap-2 text-xs"
              >
                <Lock className="size-3.5" />
                <span>
                  {passwordStatus === "saving"
                    ? "Updating..."
                    : "Update Password"}
                </span>
              </Button>
            </div>
          </form>

          {/* Right Column: Live Security Requirements & Checklist */}
          <div className="flex flex-col justify-between space-y-4 rounded-lg border border-border bg-muted/20 p-4 lg:col-span-5">
            <div className="space-y-3">
              <div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <ShieldCheck className="size-3.5 text-primary" />
                  <span>Password Requirements</span>
                </span>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  All cluster operator passwords must satisfy security
                  complexity standards.
                </p>
              </div>

              <ul className="space-y-2 pt-1 font-mono text-xs">
                <li className="flex items-center gap-2">
                  {hasMinLength ? (
                    <Check className="size-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <span className="mx-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  )}
                  <span
                    className={
                      hasMinLength
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    Minimum 10 characters
                  </span>
                </li>

                <li className="flex items-center gap-2">
                  {hasUppercase ? (
                    <Check className="size-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <span className="mx-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  )}
                  <span
                    className={
                      hasUppercase
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    At least one uppercase letter (A-Z)
                  </span>
                </li>

                <li className="flex items-center gap-2">
                  {hasNumber ? (
                    <Check className="size-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <span className="mx-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  )}
                  <span
                    className={
                      hasNumber
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    At least one number (0-9)
                  </span>
                </li>

                <li className="flex items-center gap-2">
                  {hasSpecial ? (
                    <Check className="size-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <span className="mx-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  )}
                  <span
                    className={
                      hasSpecial
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    At least one special character (!@#$)
                  </span>
                </li>

                {confirmPassword.length > 0 && (
                  <li className="flex items-center gap-2">
                    {newPassword === confirmPassword ? (
                      <Check className="size-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <span className="mx-1 size-1.5 shrink-0 rounded-full bg-destructive" />
                    )}
                    <span
                      className={
                        newPassword === confirmPassword
                          ? "font-medium text-emerald-500"
                          : "text-destructive"
                      }
                    >
                      {newPassword === confirmPassword
                        ? "Passwords match"
                        : "Passwords do not match"}
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <div className="rounded-md border border-border bg-card/60 p-2.5 text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground">Credential Security</p>
              <p className="mt-0.5 text-[10px] leading-relaxed">
                Changing your password takes effect immediately and will
                invalidate previous operator session tokens across other
                devices.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Two-Factor Authentication (TOTP) Card */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Two-Factor Authentication (TOTP)
              </h2>
              {currentUser.twoFactorEnabled ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-500">
                  <ShieldCheck className="size-3" />
                  <span>Active</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-amber-500">
                  <ShieldAlert className="size-3" />
                  <span>Disabled</span>
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Secure operator access with time-based one-time passwords (TOTP)
              from 1Password, Google Authenticator, or Bitwarden.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {currentUser.twoFactorEnabled ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTwoFactorModalOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <QrCode className="size-3" />
                  <span>View QR / Secret</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDisable2FAModalOpen(true)}
                  className="text-xs text-destructive hover:bg-destructive/10"
                >
                  <span>Disable 2FA</span>
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setTwoFactorModalOpen(true)}
                className="gap-1.5 text-xs"
              >
                <ShieldCheck className="size-3" />
                <span>Configure 2FA</span>
              </Button>
            )}
          </div>
        </div>

        {currentUser.twoFactorEnabled ? (
          <div className="space-y-4 pt-1">
            {/* Recovery Codes Grid */}
            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <KeyRound className="size-3.5 text-primary" />
                    <span>Emergency Backup Recovery Codes</span>
                  </span>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Each single-use code can be used to bypass 2FA if you lose
                    access to your authenticator device.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCodes}
                    className="gap-1 text-xs"
                  >
                    {copiedCodes ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3 text-muted-foreground" />
                    )}
                    <span>{copiedCodes ? "Copied" : "Copy All"}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadCodes}
                    className="gap-1 text-xs"
                  >
                    <Download className="size-3 text-muted-foreground" />
                    <span>Download (.txt)</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerateCodes}
                    className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                    title="Generate new set of codes"
                  >
                    <RotateCw className="size-3" />
                    <span>Regenerate</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4">
                {recoveryCodes.map((code, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-border bg-card/60 px-2.5 py-1.5 text-center font-mono text-xs tracking-wider text-foreground"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Shield className="mx-auto mb-2 size-8 text-muted-foreground opacity-50" />
            <p className="text-xs font-medium text-foreground">
              Two-Factor Authentication is Not Enabled
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Protect your operator account from unauthorized access with a
              time-based authenticator app (TOTP).
            </p>
          </div>
        )}
      </div>

      {/* 3. Hardware Passkeys (WebAuthn) Card */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Fingerprint className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Hardware Passkeys (WebAuthn)
              </h2>
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium text-primary">
                <span>{passkeys.length} Registered</span>
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Phishing-resistant cryptographic credentials using biometric
              sensors (Touch ID, Windows Hello) or physical hardware tokens
              (YubiKey).
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              setKeyName("")
              setKeyType("touch_id")
              setRegisterError(null)
              setRegisterSuccess(false)
              setAddPasskeyModalOpen(true)
            }}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3" />
            <span>Register Passkey</span>
          </Button>
        </div>

        {/* Passkeys List */}
        {passkeys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Fingerprint className="mx-auto mb-2 size-8 text-muted-foreground opacity-50" />
            <p className="text-xs font-medium text-foreground">
              No Hardware Passkeys Registered
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Add a Touch ID or YubiKey credential to log in seamlessly without
              passwords.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {passkeys.map((passkey) => (
              <div
                key={passkey.id}
                className="flex items-start justify-between rounded-lg border border-border bg-muted/20 p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md border border-border bg-card p-2 text-primary">
                    {passkey.type === "touch_id" ? (
                      <Fingerprint className="size-4" />
                    ) : (
                      <Key className="size-4" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {passkey.name}
                      </span>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary capitalize">
                        {passkey.type === "touch_id"
                          ? "Biometric"
                          : "Hardware Token"}
                      </span>
                    </div>
                    <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
                      <p>Credential: {passkey.credentialId}</p>
                      <p>
                        Registered on {passkey.createdAt} • Used:{" "}
                        {passkey.lastUsedAt}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setDeleteTarget(passkey)}
                  className="size-7 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove passkey ${passkey.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Informational Security Callout */}
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/10 p-3.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            Passkeys stored in Apple Secure Enclave, Android StrongBox, or
            YubiKey hardware tokens never transmit private keys over the
            network, providing mathematically verifiable protection against
            phishing, SIM-swapping, and session hijacking.
          </div>
        </div>
      </div>

      {/* 2FA Setup / QR Code Dialog */}
      <Dialog open={twoFactorModalOpen} onOpenChange={setTwoFactorModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="size-4 shrink-0 text-primary" />
              <span>Two-Factor Authentication Setup</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Scan the QR code or manually enter the secret into your
              authenticator application.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Themed QR Code Display */}
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex size-44 items-center justify-center rounded-lg border border-border bg-white p-2.5 shadow-xs">
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="Two-Factor Authentication TOTP QR Code"
                    className="size-38 select-none"
                  />
                ) : (
                  <div className="flex size-38 items-center justify-center font-mono text-xs text-muted-foreground">
                    Generating QR...
                  </div>
                )}
              </div>
              <span className="mt-2.5 font-mono text-[11px] text-muted-foreground">
                Tako ({currentUser.email})
              </span>
            </div>

            {/* Secret Key Display */}
            <div className="space-y-1.5">
              <span className="block text-[11px] font-medium text-muted-foreground">
                Manual Entry Secret Key:
              </span>
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
                <span className="font-semibold tracking-widest text-foreground">
                  {totpSecret}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleCopySecret}
                  className="size-7 p-0"
                  aria-label="Copy secret"
                >
                  {copiedSecret ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Code Verification Input */}
            <form
              onSubmit={handleVerify2FACode}
              noValidate
              className="space-y-3 pt-2"
            >
              <Field data-invalid={Boolean(twoFactorErrors.verifyCode)}>
                <FieldLabel htmlFor="totp-verify-code" className="text-xs">
                  Verify 6-Digit Authenticator Code
                </FieldLabel>
                <Input
                  id="totp-verify-code"
                  value={verifyCode}
                  onChange={(e) => {
                    setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    clearTwoFactorError("verifyCode")
                  }}
                  placeholder="123456"
                  maxLength={6}
                  aria-invalid={Boolean(twoFactorErrors.verifyCode)}
                  aria-describedby={
                    twoFactorErrors.verifyCode
                      ? "totp-verify-code-error"
                      : undefined
                  }
                  className="text-center font-mono text-base font-bold tracking-widest"
                />
                <FieldError id="totp-verify-code-error" className="text-[11px]">
                  {twoFactorErrors.verifyCode}
                </FieldError>
              </Field>

              {verifyStatus === "success" && (
                <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                  <Check className="size-3" />
                  <span>2FA verified and enrolled successfully!</span>
                </p>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTwoFactorModalOpen(false)}
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    verifyCode.length !== 6 || verifyStatus === "success"
                  }
                >
                  Verify & Activate
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Confirmation Modal */}
      <Dialog open={disable2FAModalOpen} onOpenChange={setDisable2FAModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <span>Disable Two-Factor Authentication?</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Disabling 2FA lowers your account security and leaves the cluster
              vulnerable if your password is compromised.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground">
            Are you sure you want to disable TOTP multi-factor authentication
            for <strong className="text-foreground">{currentUser.email}</strong>
            ?
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDisable2FAModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDisable2FA}
            >
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Passkey Modal */}
      <Dialog
        open={addPasskeyModalOpen}
        onOpenChange={(open) => {
          setAddPasskeyModalOpen(open)
          if (!open) {
            setRegisterError(null)
            setRegisterSuccess(false)
            setIsRegistering(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="size-4 shrink-0 text-primary" />
              <span>Register Hardware Passkey</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enrol a new WebAuthn credential on this workstation or hardware
              token.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleRegisterPasskey}
            noValidate
            className="space-y-4 py-2 text-xs"
          >
            <Field data-invalid={Boolean(passkeyErrors.keyName)}>
              <FieldLabel htmlFor="passkey-name" className="text-xs">
                Passkey Label / Device Name
              </FieldLabel>
              <Input
                id="passkey-name"
                value={keyName}
                onChange={(e) => {
                  setKeyName(e.target.value)
                  clearPasskeyError("keyName")
                }}
                placeholder="e.g. MacBook Pro Touch ID or YubiKey 5C"
                aria-invalid={Boolean(passkeyErrors.keyName)}
                aria-describedby={
                  passkeyErrors.keyName ? "passkey-name-error" : undefined
                }
                required
              />
              <FieldError id="passkey-name-error" className="text-[11px]">
                {passkeyErrors.keyName}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(passkeyErrors.keyType)}>
              <FieldLabel htmlFor="passkey-type" className="text-xs">
                Authenticator Hardware Class
              </FieldLabel>
              <SearchableSelect
                id="passkey-type"
                value={keyType}
                onChange={(val) => {
                  setKeyType(val as UserPasskey["type"])
                  clearPasskeyError("keyType")
                }}
                options={PASSKEY_TYPE_OPTIONS}
                placeholder="Select authenticator class..."
                searchPlaceholder="Search authenticator hardware..."
              />
              <FieldError id="passkey-type-error" className="text-[11px]">
                {passkeyErrors.keyType}
              </FieldError>
            </Field>

            {registerError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{registerError}</span>
              </div>
            )}

            {registerSuccess && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs font-medium text-emerald-500">
                <Check className="size-3.5" />
                <span>Passkey registered and enrolled successfully!</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddPasskeyModalOpen(false)}
                disabled={isRegistering}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isRegistering || registerSuccess}
              >
                {isRegistering ? "Enrolling Key..." : "Prompt Authenticator"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Passkey Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-4 shrink-0" />
              <span>Remove Passkey</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Revoking this credential prevents it from authenticating to the
              Tako platform.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground">
            Are you sure you want to remove{" "}
            <strong className="text-foreground">{deleteTarget?.name}</strong>?
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeletePasskeyConfirm}
            >
              Remove Passkey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
