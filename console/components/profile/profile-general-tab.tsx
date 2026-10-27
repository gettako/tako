"use client"

import * as React from "react"
import { Check, Globe, Save, ShieldCheck, User } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
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

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(80, "Full name must be 80 characters or fewer."),
  handle: z
    .string()
    .trim()
    .min(2, "Handle must be at least 2 characters.")
    .max(32, "Handle must be 32 characters or fewer.")
    .regex(
      /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i,
      "Use letters, numbers, dots, underscores, or hyphens only."
    ),
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  timezone: z.string().min(1, "Select a timezone."),
})

export const TIMEZONE_OPTIONS: SelectOption[] = [
  {
    value: "Asia/Makassar (UTC+08:00)",
    label: "Asia/Makassar (UTC+08:00)",
    description: "Central Indonesia Time (WITA)",
  },
  {
    value: "Asia/Jakarta (UTC+07:00)",
    label: "Asia/Jakarta (UTC+07:00)",
    description: "Western Indonesia Time (WIB)",
  },
  {
    value: "Asia/Singapore (UTC+08:00)",
    label: "Asia/Singapore (UTC+08:00)",
    description: "Singapore Standard Time (SGT)",
  },
  {
    value: "Asia/Tokyo (UTC+09:00)",
    label: "Asia/Tokyo (UTC+09:00)",
    description: "Japan Standard Time (JST)",
  },
  {
    value: "Europe/London (UTC+00:00)",
    label: "Europe/London (UTC+00:00)",
    description: "Greenwich Mean Time (GMT/BST)",
  },
  {
    value: "America/New_York (UTC-05:00)",
    label: "America/New_York (UTC-05:00)",
    description: "Eastern Time (ET)",
  },
  {
    value: "America/Los_Angeles (UTC-08:00)",
    label: "America/Los_Angeles (UTC-08:00)",
    description: "Pacific Time (PT)",
  },
  {
    value: "UTC (Coordinated Universal Time)",
    label: "UTC (Coordinated Universal Time)",
    description: "Global UTC Reference",
  },
]

export function ProfileGeneralTab() {
  const { currentUser, updateCurrentUser, sessions } = usePlatformData()

  const [name, setName] = React.useState(currentUser.name)
  const [handle, setHandle] = React.useState(currentUser.handle)
  const [email, setEmail] = React.useState(currentUser.email)
  const [timezone, setTimezone] = React.useState(currentUser.timezone)
  const { errors, validate, clearError } = useZodForm(profileSchema)

  const [saved, setSaved] = React.useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validate({
      name,
      handle: handle.trim().replace(/^@/, ""),
      email,
      timezone,
    })
    if (!valid) return

    updateCurrentUser({
      name: name.trim(),
      handle: handle.trim().replace(/^@/, ""),
      email: email.trim(),
      timezone,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="size-4 text-primary" />
              <span>Operator Identity & Access Profile</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Personal credentials, operational timezone, and cluster role
              attributes.
            </p>
          </div>
          {saved && (
            <span className="flex animate-in items-center gap-1.5 font-mono text-xs text-emerald-500 fade-in">
              <Check className="size-3.5" />
              <span>Changes Saved</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Form Fields */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-4 lg:col-span-7"
          >
            <FieldGroup className="gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel htmlFor="operator-name" className="text-xs">
                    Full Name
                  </FieldLabel>
                  <Input
                    id="operator-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      clearError("name")
                    }}
                    placeholder="e.g. Supian M"
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={
                      errors.name ? "operator-name-error" : undefined
                    }
                    required
                  />
                  <FieldError id="operator-name-error" className="text-[11px]">
                    {errors.name}
                  </FieldError>
                </Field>

                <Field data-invalid={Boolean(errors.handle)}>
                  <FieldLabel htmlFor="operator-handle" className="text-xs">
                    Handle / Username
                  </FieldLabel>
                  <div className="relative">
                    <span className="absolute top-2.5 left-3 font-mono text-xs text-muted-foreground">
                      @
                    </span>
                    <Input
                      id="operator-handle"
                      value={handle}
                      onChange={(e) => {
                        setHandle(e.target.value)
                        clearError("handle")
                      }}
                      placeholder="supian"
                      aria-invalid={Boolean(errors.handle)}
                      aria-describedby={
                        errors.handle ? "operator-handle-error" : undefined
                      }
                      className="pl-7 font-mono"
                      required
                    />
                  </div>
                  <FieldError
                    id="operator-handle-error"
                    className="text-[11px]"
                  >
                    {errors.handle}
                  </FieldError>
                </Field>
              </div>

              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="operator-email" className="text-xs">
                  Primary Alert & Account Email
                </FieldLabel>
                <Input
                  id="operator-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    clearError("email")
                  }}
                  placeholder="operator@gettako.dev"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={
                    errors.email ? "operator-email-error" : undefined
                  }
                  className="font-mono text-xs"
                  required
                />
                <FieldError id="operator-email-error" className="text-[11px]">
                  {errors.email}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.timezone)}>
                <FieldLabel
                  htmlFor="operator-timezone"
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Globe className="size-3 text-primary" />
                  <span>Operational Timezone</span>
                </FieldLabel>
                <SearchableSelect
                  id="operator-timezone"
                  value={timezone}
                  onChange={(val) => {
                    setTimezone(val)
                    clearError("timezone")
                  }}
                  options={TIMEZONE_OPTIONS}
                  placeholder="Select timezone..."
                  searchPlaceholder="Search timezone..."
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Applied to timestamp displays across cluster telemetry
                  streams, logs, and node heartbeats.
                </p>
                <FieldError
                  id="operator-timezone-error"
                  className="text-[11px]"
                >
                  {errors.timezone}
                </FieldError>
              </Field>
            </FieldGroup>

            <div className="pt-2">
              <Button type="submit" size="sm" className="gap-2 text-xs">
                {saved ? (
                  <>
                    <Check className="size-3.5" />
                    <span>Profile Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    <span>Save Profile Changes</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Right Column: Account & Access Overview */}
          <div className="flex flex-col justify-between space-y-4 rounded-lg border border-border bg-muted/20 p-4 lg:col-span-5">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <ShieldCheck className="size-3.5 text-primary" />
                    <span>Cluster Access & Role</span>
                  </span>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Privilege boundary and authority level.
                  </p>
                </div>
                <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary capitalize">
                  {currentUser.role === "owner"
                    ? "Cluster Owner"
                    : "Platform Admin"}
                </span>
              </div>

              {/* Active Scopes */}
              <div className="space-y-1.5 font-mono text-xs">
                <span className="block text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                  Authorized Capabilities
                </span>
                <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="size-3 shrink-0 text-emerald-500" />
                    <span className="text-foreground">
                      Full mesh & edge topology orchestration
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3 shrink-0 text-emerald-500" />
                    <span className="text-foreground">
                      Node provisioning & compute management
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3 shrink-0 text-emerald-500" />
                    <span className="text-foreground">
                      Secrets & cryptographic deployment signing
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3 shrink-0 text-emerald-500" />
                    <span className="text-foreground">
                      System telemetry, audit logs & trace streams
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Quick Status Info */}
            <div className="space-y-2 rounded-md border border-border bg-card/60 p-3 text-xs">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-muted-foreground">Security State:</span>
                {currentUser.twoFactorEnabled ? (
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-500">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>2FA Protected</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-medium text-amber-500">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    <span>2FA Not Enabled</span>
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-muted-foreground">Active Sessions:</span>
                <span className="font-medium text-foreground">
                  {sessions.length} device(s)
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-muted-foreground">Member Since:</span>
                <span className="text-foreground">{currentUser.createdAt}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
