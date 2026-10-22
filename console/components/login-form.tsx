"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircleIcon,
  CheckIcon,
  CopyIcon,
  FingerprintIcon,
  Loader2Icon,
  TerminalIcon,
} from "lucide-react"
import { cn } from "cn"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
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
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { usePlatformData } from "@/context/platform-data-context"
import { copyToClipboard } from "@/lib/clipboard"
import { useZodForm } from "@/hooks/use-zod-form"

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  password: z
    .string()
    .min(1, "Password is required.")
    .min(8, "Password must be at least 8 characters."),
})

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter()
  const { login, loginWithPasskey } = usePlatformData()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const { errors, validate, clearError } = useZodForm(loginSchema)
  const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false)
  const [isCopied, setIsCopied] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [passkeyStatus, setPasskeyStatus] = React.useState<string | null>(null)

  const resetCommand = `tako user reset-password ${email.trim() || "<email>"}`

  const handleCopyCommand = async () => {
    if (await copyToClipboard(resetCommand)) {
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const valid = validate({ email, password })
    if (!valid) return

    setIsSubmitting(true)
    try {
      await login(email.trim(), password)
      router.push("/dashboard")
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid email or password."
      setFormError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasskeyLogin = async () => {
    setFormError(null)
    setPasskeyStatus("Checking security key or biometric sensor...")
    setIsPasskeyLoading(true)

    let credentialId: string | undefined = undefined

    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      try {
        const challenge = new Uint8Array(32)
        window.crypto.getRandomValues(challenge)

        const cred = (await Promise.race([
          navigator.credentials?.get({
            publicKey: {
              challenge,
              timeout: 30000,
              userVerification: "preferred",
            },
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 8000)
          ),
        ])) as PublicKeyCredential | null

        if (cred && cred.id) {
          credentialId = cred.id
        }
      } catch (err: unknown) {
        const isAbort =
          err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "AbortError")
        setPasskeyStatus(
          isAbort
            ? "Passkey request cancelled. Sign in with password or retry."
            : "No response from security key. Sign in with password first."
        )
        setIsPasskeyLoading(false)
        return
      }
    } else {
      setPasskeyStatus("Passkeys are not supported in this browser environment.")
      setIsPasskeyLoading(false)
      return
    }

    if (!credentialId) {
      setPasskeyStatus("No credential ID received. Sign in with password first.")
      setIsPasskeyLoading(false)
      return
    }

    try {
      setPasskeyStatus("Authenticating with passkey...")
      await loginWithPasskey(credentialId)
      setPasskeyStatus("Authenticated successfully. Redirecting...")
      router.push("/dashboard")
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Passkey authentication failed. Sign in with password first."
      setPasskeyStatus(message)
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        noValidate
        className={cn("flex flex-col gap-6", className)}
        {...props}
      >
        <FieldGroup className="gap-4">
          <div className="flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-bold">Login to your account</h1>
            <p className="text-sm text-balance text-muted-foreground">
              Enter your email below to login to your account
            </p>
          </div>

          {formError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
              <AlertCircleIcon className="size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Field data-invalid={Boolean(errors.email)}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                clearError("email")
                setFormError(null)
              }}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              required
            />
            <FieldError id="login-email-error" className="text-[11px]">
              {errors.email}
            </FieldError>
          </Field>
          <Field data-invalid={Boolean(errors.password)}>
            <div className="flex items-center">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <button
                type="button"
                onClick={() => setIsResetDialogOpen(true)}
                className="ml-auto rounded text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Forgot your password?
              </button>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearError("password")
                setFormError(null)
              }}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "login-password-error" : undefined
              }
              required
            />
            <FieldError id="login-password-error" className="text-[11px]">
              {errors.password}
            </FieldError>
          </Field>
          <Field>
            <Button type="submit" disabled={isSubmitting || isPasskeyLoading} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </Field>
          <FieldSeparator>Or continue with</FieldSeparator>
          <Field>
            <Button
              variant="outline"
              type="button"
              onClick={handlePasskeyLogin}
              disabled={isSubmitting || isPasskeyLoading}
              className="w-full"
            >
              {isPasskeyLoading ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : (
                <FingerprintIcon className="size-4 mr-2" />
              )}
              Sign in with Passkey
            </Button>
            {passkeyStatus && (
              <output className="mt-1 block text-center text-xs text-muted-foreground">
                {passkeyStatus}
              </output>
            )}
          </Field>
        </FieldGroup>
      </form>

      {/* Password Reset Modal via Server Command */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-foreground">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <TerminalIcon className="size-4" />
              </div>
              <DialogTitle className="text-lg">
                Reset Password via Server
              </DialogTitle>
            </div>
            <DialogDescription className="text-left text-sm text-muted-foreground">
              On Tako architecture, password resets are performed directly on
              the host server via the CLI to maintain zero-trust security.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-xs font-medium text-muted-foreground">
              Run the following command on your server host:
            </p>

            <div className="relative flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3.5 font-mono text-xs text-foreground dark:bg-muted/15">
              <span className="overflow-x-auto pr-2 font-mono text-[13px] select-all">
                {resetCommand}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleCopyCommand}
                className="h-8 shrink-0 gap-1.5 px-3 text-xs"
              >
                {isCopied ? (
                  <>
                    <CheckIcon className="size-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="size-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-1.5 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Instructions:</p>
              <ol className="list-inside list-decimal space-y-1">
                <li>Open an SSH session to your Tako server instance.</li>
                <li>Execute the command above.</li>
                <li>Follow the console prompt to set a new password.</li>
              </ol>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Close
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
