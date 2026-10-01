"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AppWindowIcon,
  LockIcon,
  CircleNotchIcon,
  UserIcon,
  EnvelopeSimpleIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldError } from "@/components/ui/field"
import { ErrorCard } from "@/components/states/error-card"
import { ThemeToggle } from "@/components/theme-toggle"
import { useApi, ApiError, type InviteValidationResponse } from "@/lib/api"
import { setSessionCookie } from "@/lib/auth"
import { validateWithZod, mapApiError } from "@/lib/validation"

const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Full name is required."),
    email: z
      .string()
      .trim()
      .min(1, "Email address is required.")
      .email("A valid email address is required."),
    password: z.string().min(8, "Password must be at least 8 characters long."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const api = useApi()

  const token = searchParams.get("token") || ""

  // State
  const [isValidating, setIsValidating] = React.useState(true)
  const [validationInfo, setValidationInfo] =
    React.useState<InviteValidationResponse | null>(null)
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  )

  // Form Fields
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")

  // Submission State
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {}
  )

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  // Validate token on mount
  React.useEffect(() => {
    let isMounted = true

    async function checkToken() {
      if (!token.trim()) {
        if (isMounted) {
          setIsValidating(false)
          setValidationError(
            "An invitation token is required in the URL to register."
          )
        }
        return
      }

      try {
        const res = await api.invites.validate(token.trim())
        if (!isMounted) return
        if (res.valid) {
          setValidationInfo(res)
        } else {
          setValidationError("This invitation link is invalid or has expired.")
        }
      } catch (err) {
        if (!isMounted) return
        const msg =
          err instanceof ApiError
            ? err.message
            : "Failed to validate invitation token."
        setValidationError(msg)
      } finally {
        if (isMounted) {
          setIsValidating(false)
        }
      }
    }

    checkToken()

    return () => {
      isMounted = false
    }
  }, [token, api])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validation = validateWithZod(registerSchema, {
      name,
      email,
      password,
      confirmPassword,
    })
    if (!validation.success) {
      setFieldErrors(validation.errors)
      return
    }

    setFieldErrors({})
    setFormError(null)
    setIsSubmitting(true)

    try {
      const response = await api.invites.accept({
        token: token.trim(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      })

      if (response.session_id) {
        setSessionCookie(response.session_id)
      }
      router.push("/")
    } catch (err) {
      const { fieldErrors: apiFieldErrors, generalError: apiGeneralError } =
        mapApiError(err)
      if (Object.keys(apiFieldErrors).length > 0) {
        setFieldErrors(apiFieldErrors)
      }
      if (apiGeneralError) {
        setFormError(apiGeneralError)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6 rounded-lg border border-border bg-card p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex aspect-square size-9 items-center justify-center rounded-md border border-border bg-foreground text-background">
            <AppWindowIcon className="size-5" weight="bold" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">
              Tako
            </h1>
            <p className="text-xs text-muted-foreground">Control Plane</p>
          </div>
        </div>

        <div className="mt-2">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            Join the Workspace
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete your registration to access shared clusters and services.
          </p>
        </div>
      </div>

      {/* Validation Loading State */}
      {isValidating ? (
        <div
          data-testid="register-validating-state"
          className="flex flex-col items-center justify-center gap-3 py-10 text-center"
        >
          <CircleNotchIcon className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Validating invitation token...
          </p>
        </div>
      ) : validationError ? (
        /* Invalid or Missing Token State */
        <div data-testid="register-error-state" className="flex flex-col gap-4">
          <ErrorCard title="Invitation Error" message={validationError} />
          <div className="rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            Invitation links are single-use and expire after 7 days. If you
            believe this is a mistake, contact your cluster administrator for a
            new invitation link.
          </div>
          <Button
            variant="outline"
            className="w-full gap-2 border-border"
            render={<Link href="/login" />}
          >
            <span>Return to Sign In</span>
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      ) : (
        /* Valid Registration Form */
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <WarningCircleIcon className="size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Role pill indicator */}
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Assigned Role</span>
            {validationInfo?.role === "admin" ? (
              <span className="inline-flex items-center rounded border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-purple-700 uppercase dark:text-purple-400">
                Admin
              </span>
            ) : (
              <span className="inline-flex items-center rounded border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-700 uppercase dark:text-zinc-400">
                Member
              </span>
            )}
          </div>

          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="name"
              className="text-xs font-medium text-foreground"
            >
              Full Name
            </label>
            <div className="relative">
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Alex Mercer"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  clearFieldError("name")
                }}
                disabled={isSubmitting}
                aria-invalid={!!fieldErrors.name}
                autoFocus
                className="pr-9"
              />
              <UserIcon
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <FieldError message={fieldErrors.name} />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-xs font-medium text-foreground"
            >
              Email Address
            </label>
            <div className="relative">
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="alex@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearFieldError("email")
                }}
                disabled={isSubmitting}
                aria-invalid={!!fieldErrors.email}
                className="pr-9"
              />
              <EnvelopeSimpleIcon
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <FieldError message={fieldErrors.email} />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  clearFieldError("password")
                }}
                disabled={isSubmitting}
                aria-invalid={!!fieldErrors.password}
                className="pr-9"
              />
              <LockIcon
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <FieldError message={fieldErrors.password} />
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirmPassword"
              className="text-xs font-medium text-foreground"
            >
              Confirm Password
            </label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  clearFieldError("confirmPassword")
                }}
                disabled={isSubmitting}
                aria-invalid={!!fieldErrors.confirmPassword}
                className="pr-9"
              />
              <LockIcon
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <FieldError message={fieldErrors.confirmPassword} />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full gap-2"
          >
            {isSubmitting ? (
              <>
                <CircleNotchIcon
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
                <span>Setting up account...</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="size-4" aria-hidden="true" />
                <span>Create Account & Sign In</span>
              </>
            )}
          </Button>

          <div className="mt-2 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Sign in
            </Link>
          </div>
        </form>
      )}

      {/* Footer */}
      <div className="border-t border-border pt-4 text-center">
        <p className="text-xs text-muted-foreground">
          Tako Self-Hosted Control Plane
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Tako - Register"
    }
  }, [])

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center bg-background p-4 md:p-6">
      <title>Tako - Register</title>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <React.Suspense
        fallback={
          <div className="flex w-full max-w-md flex-col items-center justify-center rounded-lg border border-border bg-card p-12">
            <CircleNotchIcon className="size-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <RegisterForm />
      </React.Suspense>
    </main>
  )
}
