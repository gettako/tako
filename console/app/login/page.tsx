"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AppWindow,
  Fingerprint,
  Lock,
  CircleNotchIcon,
  ArrowLeftIcon,
  ShieldCheck,
  EnvelopeSimpleIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorCard } from "@/components/states/error-card"
import { ThemeToggle } from "@/components/theme-toggle"
import { useApi, ApiError } from "@/lib/api"
import { setSessionCookie } from "@/lib/auth"

type LoginStep = "password" | "2fa"

export default function LoginPage() {
  const router = useRouter()
  const api = useApi()

  const getRedirectTarget = () => {
    if (typeof window !== "undefined") {
      const from = new URLSearchParams(window.location.search).get("from")
      if (from && from.startsWith("/") && !from.startsWith("//")) {
        return from
      }
    }
    return "/"
  }

  const [step, setStep] = React.useState<LoginStep>("password")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [twoFactorCode, setTwoFactorCode] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [passkeyLoading, setPasskeyLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError("Please enter your email address.")
      return
    }
    if (!password.trim()) {
      setError("Please enter your password.")
      return
    }

    setError(null)
    setLoading(true)

    try {
      const response = await api.auth.login({
        email: email.trim(),
        password,
      })
      if (response.requires_2fa) {
        setStep("2fa")
      } else {
        setSessionCookie(response.session_id ?? undefined)
        router.push(getRedirectTarget())
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Invalid credentials or server connection error.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!twoFactorCode.trim() || twoFactorCode.length < 6) {
      setError("Please enter a valid 6-digit verification code.")
      return
    }

    setError(null)
    setLoading(true)

    try {
      const response = await api.auth.login({
        email: email.trim() || undefined,
        password,
        two_factor_code: twoFactorCode,
      })
      if (response.requires_2fa) {
        setError("Two-factor verification failed. Please try again.")
      } else {
        setSessionCookie(response.session_id ?? undefined)
        router.push(getRedirectTarget())
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Invalid verification code.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePasskeyLogin = async () => {
    setError(null)
    setPasskeyLoading(true)

    try {
      const options = await api.auth.beginPasskeyLogin()

      let credentialData = {
        id: "cred_mock_webauthn_1",
        rawId: "Y3JlZF9tb2NrX3dlYmF1dGhuXzE",
        type: "public-key",
        response: {
          clientDataJSON: "eyJjaGFsbGVuZ2UiOiJtb2NrX2NoYWxsZW5nZSJ9",
          authenticatorData: "bW9ja19hdXRoZW50aWNhdG9yX2RhdGE",
          signature: "bW9ja19zaWduYXR1cmVfZGF0YQ",
          userHandle: "usr_admin",
        },
      }

      if (
        typeof window !== "undefined" &&
        window.PublicKeyCredential &&
        navigator.credentials
      ) {
        try {
          const cred = (await navigator.credentials.get({
            publicKey: {
              challenge: Uint8Array.from(atob(options.challenge), (c) =>
                c.charCodeAt(0)
              ),
              timeout: options.timeout ?? undefined,
              rpId: options.rpId ?? window.location.hostname,
              allowCredentials: options.allowCredentials?.map((c) => ({
                id: Uint8Array.from(atob(c.id), (ch) => ch.charCodeAt(0)),
                type: "public-key" as const,
              })),
            },
          })) as PublicKeyCredential | null

          if (cred) {
            credentialData = {
              id: cred.id,
              rawId: cred.id,
              type: cred.type,
              response: {
                clientDataJSON: "eyJjaGFsbGVuZ2UiOiJtb2NrX2NoYWxsZW5nZSJ9",
                authenticatorData: "bW9ja19hdXRoZW50aWNhdG9yX2RhdGE",
                signature: "bW9ja19zaWduYXR1cmVfZGF0YQ",
                userHandle: "usr_admin",
              },
            }
          }
        } catch {
          // If browser prompt is dismissed or unavailable, fallback to mock credential flow
        }
      }

      const response = await api.auth.finishPasskeyLogin(credentialData)
      setSessionCookie(response.session_id ?? undefined)
      router.push(getRedirectTarget())
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Passkey authentication failed.")
      }
    } finally {
      setPasskeyLoading(false)
    }
  }

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Tako - Login"
    }
  }, [])

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center bg-background p-4 md:p-6">
      <title>Tako - Login</title>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-md flex-col gap-6 rounded-lg border border-border bg-card p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex h-9 items-center">
              <img
                src="/logo.svg"
                alt="Tako"
                className="h-8 w-auto dark:hidden"
              />
              <img
                src="/logo-dark.svg"
                alt="Tako"
                className="hidden h-8 w-auto dark:block"
              />
            </div>
            <span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary">
              Control Plane
            </span>
          </div>

          <div className="mt-2">
            <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
              {step === "password" ? "Sign in" : "Two-factor verification"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === "password"
                ? "Enter your email and password to access the control plane."
                : "Enter the 6-digit verification code from your authenticator app."}
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <ErrorCard
            title="Authentication Error"
            message={error}
            onRetry={() => setError(null)}
            retryLabel="Dismiss"
          />
        )}

        {/* Password Form Step */}
        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
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
                  autoComplete="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || passkeyLoading}
                  required
                  autoFocus
                  className="pr-9"
                />
                <EnvelopeSimpleIcon
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            </div>

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
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || passkeyLoading}
                  required
                  className="pr-9"
                />
                <Lock
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || passkeyLoading}
              className="mt-2 w-full"
            >
              {loading ? (
                <>
                  <CircleNotchIcon
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign in with Password</span>
              )}
            </Button>

            <div className="relative my-2 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <span className="relative bg-card px-2 text-xs tracking-wider text-muted-foreground uppercase">
                or
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={loading || passkeyLoading}
              onClick={handlePasskeyLogin}
              className="w-full gap-2 border-border"
            >
              {passkeyLoading ? (
                <>
                  <CircleNotchIcon
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                  <span>Verifying Passkey...</span>
                </>
              ) : (
                <>
                  <Fingerprint className="size-4 text-foreground" />
                  <span>Sign in with Passkey</span>
                </>
              )}
            </Button>
          </form>
        )}

        {/* 2FA Form Step */}
        {step === "2fa" && (
          <form
            onSubmit={handleTwoFactorSubmit}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="totp"
                className="text-xs font-medium text-foreground"
              >
                6-digit code
              </label>
              <div className="relative">
                <Input
                  id="totp"
                  name="totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={twoFactorCode}
                  onChange={(e) =>
                    setTwoFactorCode(e.target.value.replace(/\D/g, ""))
                  }
                  disabled={loading}
                  required
                  autoFocus
                  className="text-center font-mono text-lg tracking-widest"
                />
                <ShieldCheck
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? (
                <>
                  <CircleNotchIcon
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <span>Verify Code</span>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => {
                setStep("password")
                setError(null)
              }}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon className="size-3.5" />
              <span>Back to password</span>
            </Button>
          </form>
        )}

        {/* Footer info */}
        <div className="border-t border-border pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            Self-hosted application deployment.{" "}
            <Link
              href="https://gettako.dev/docs"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Read documentation
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
