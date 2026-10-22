"use client"

import * as React from "react"
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  QrCode,
  RotateCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"

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
import { usePlatformData } from "@/context/platform-data-context"
import { useZodForm } from "@/hooks/use-zod-form"
import { copyToClipboard } from "@/lib/clipboard"
import { z } from "zod"

const DEFAULT_RECOVERY_CODES = [
  "A8F1-9B2C",
  "4D5E-6F7A",
  "8B9C-0D1E",
  "2F3A-4B5C",
  "6D7E-8F9A",
  "0B1C-2D3E",
  "4F5A-6B7C",
  "8D9E-0F1A",
]

const passwordSchema = z
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

const twoFactorSchema = z.object({
  verifyCode: z
    .string()
    .regex(/^\d{6}$/, "Enter the 6-digit authenticator code."),
})

export function ProfileSecurityTab() {
  const { currentUser, updateCurrentUser, addAuditLog } = usePlatformData()

  // Password state
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

  // 2FA state
  const [twoFactorModalOpen, setTwoFactorModalOpen] = React.useState(false)
  const [disable2FAModalOpen, setDisable2FAModalOpen] = React.useState(false)
  const [verifyCode, setVerifyCode] = React.useState("")
  const [verifyStatus, setVerifyStatus] = React.useState<string | null>(null)
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

  const totpSecret = "TAKO-7X9B-M4K2-Q8P1-J3N9"

  // Password Strength Calculation
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

  return (
    <div className="space-y-6">
      {/* 1. Two-Factor Authentication (TOTP) Card */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Multi-Factor Authentication (2FA / TOTP)
              </h2>
              {currentUser.twoFactorEnabled ? (
                <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-500">
                  <ShieldCheck className="size-3" />
                  <span>Enforced & Active</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-amber-500">
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

        {currentUser.twoFactorEnabled && (
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
        )}
      </div>

      {/* 2. Password Change Form */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="border-b border-border pb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Lock className="size-4 text-primary" />
            <span>Change Operator Login Password</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Require minimum 10 characters with mixed-case letters, numbers, and
            symbols to satisfy cluster security policies.
          </p>
        </div>

        <form
          onSubmit={handlePasswordSubmit}
          noValidate
          className="max-w-xl space-y-4"
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
                  passwordErrors.newPassword ? "new-password-error" : undefined
                }
                className="pr-9 font-mono text-xs"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground"
                aria-label={showNewPassword ? "Hide password" : "Show password"}
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
            {/* Visual SVG QR Code Matrix */}
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-white p-4 text-black">
              <svg
                className="size-36"
                viewBox="0 0 29 29"
                fill="currentColor"
                shapeRendering="crispEdges"
                aria-label="TOTP QR Code matrix"
              >
                {/* Simulated high-contrast QR Matrix */}
                <path d="M0 0h7v7H0zM2 2h3v3H2zM9 0h1v1H9zM11 0h1v1h-1zM13 0h3v1h-3zM18 0h1v2h-1zM22 0h7v7h-7zM24 2h3v3h-3zM0 9h1v1H0zM2 9h2v1H2zM5 9h2v1H5zM8 9h2v2H8zM12 9h2v1h-2zM15 9h1v3h-1zM18 9h1v2h-1zM21 9h2v2h-2zM25 9h1v1h-1zM28 9h1v2h-1zM9 12h1v1H9zM11 12h2v1h-2zM14 12h2v1h-2zM17 12h1v1h-1zM23 12h1v1h-1zM25 12h3v1h-3zM0 14h2v1H0zM3 14h1v1H3zM5 14h2v1H5zM9 14h1v1H9zM11 14h2v1h-2zM17 14h1v1h-1zM19 14h1v1h-1zM22 14h2v2h-2zM25 14h1v2h-1zM27 14h2v1h-2zM0 22h7v7H0zM2 24h3v3H2zM8 22h2v2H8zM12 22h1v1h-1zM15 22h1v2h-1zM18 22h1v1h-1zM21 22h1v1h-1zM24 22h1v1h-1zM27 22h2v1h-2zM9 25h1v1H9zM11 25h1v2h-1zM13 25h2v1h-2zM17 25h2v1h-2zM20 25h2v1h-2zM23 25h1v1h-1zM25 25h2v2h-2zM8 27h2v2H8zM13 27h1v2h-1zM16 27h1v1h-1zM19 27h1v2h-1zM22 27h2v1h-2zM27 27h2v2h-2z" />
              </svg>
              <span className="mt-2 font-mono text-[10px] text-zinc-600">
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
    </div>
  )
}
