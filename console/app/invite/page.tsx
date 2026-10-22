"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { apiPost, setAuthToken } from "@/lib/api"
import { useZodForm } from "@/hooks/use-zod-form"

const acceptInviteSchema = z.object({
  token: z.string().trim().min(1, "Invitation token is required."),
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

function InviteFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialToken = searchParams.get("token") || ""

  const [token, setToken] = React.useState(initialToken)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [isSuccess, setIsSuccess] = React.useState(false)

  const { errors, validate, clearError } = useZodForm(acceptInviteSchema)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const valid = validate({ token, name, email, password })
    if (!valid) return

    setIsSubmitting(true)
    try {
      const response = await apiPost<{ token: string }>("/auth/invite/accept", {
        token: token.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
      })

      if (response?.token) {
        setAuthToken(response.token)
      }

      setIsSuccess(true)
      setTimeout(() => {
        router.push("/dashboard")
      }, 1000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to accept invitation"
      setErrorMsg(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Image
              src="/images/octopy-trim.png"
              alt="Tako Logo"
              width={36}
              height={36}
              className="size-9 object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Accept Invitation
          </h1>
          <p className="text-sm text-muted-foreground">
            Join the Tako cluster control plane as an authorized operator.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
          {isSuccess ? (
            <div className="flex flex-col items-center space-y-3 py-4 text-center">
              <CheckCircle2 className="size-10 text-emerald-500 animate-in zoom-in-75 duration-300" />
              <p className="text-sm font-semibold text-foreground">
                Invitation Accepted!
              </p>
              <p className="text-xs text-muted-foreground">
                Redirecting to your cluster dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {errorMsg && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <FieldGroup className="gap-3.5">
                <Field data-invalid={Boolean(errors.token)}>
                  <FieldLabel htmlFor="token">Invite Token</FieldLabel>
                  <Input
                    id="token"
                    type="text"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value)
                      clearError("token")
                      setErrorMsg(null)
                    }}
                    placeholder="tok_..."
                    required
                  />
                  <FieldError className="text-[11px]">{errors.token}</FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel htmlFor="name">Full Name</FieldLabel>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      clearError("name")
                      setErrorMsg(null)
                    }}
                    placeholder="Alex Rivera"
                    required
                  />
                  <FieldError className="text-[11px]">{errors.name}</FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.email)}>
                  <FieldLabel htmlFor="email">Email Address</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      clearError("email")
                      setErrorMsg(null)
                    }}
                    placeholder="operator@company.com"
                    required
                  />
                  <FieldError className="text-[11px]">{errors.email}</FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.password)}>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      clearError("password")
                      setErrorMsg(null)
                    }}
                    placeholder="••••••••••••"
                    required
                  />
                  <FieldError className="text-[11px]">{errors.password}</FieldError>
                </Field>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 w-full gap-2 text-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Creating Operator Account...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" />
                      <span>Accept & Join Cluster</span>
                    </>
                  )}
                </Button>
              </FieldGroup>
            </form>
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Already registered?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in to existing account
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-xs text-muted-foreground">
          Loading invitation...
        </div>
      }
    >
      <InviteFormContent />
    </React.Suspense>
  )
}
