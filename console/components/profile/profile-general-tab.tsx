"use client"

import * as React from "react"
import { Check, KeyRound, Save, Sparkles, User } from "lucide-react"
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

const profileSchema = z.object({
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
  title: z
    .string()
    .trim()
    .max(120, "Job title must be 120 characters or fewer."),
  bio: z.string().max(500, "Notes must be 500 characters or fewer."),
  timezone: z.string().min(1, "Select a timezone."),
  defaultLanding: z.enum(["dashboard", "nodes", "projects", "monitor"]),
  gpgKeyId: z
    .string()
    .trim()
    .refine(
      (value) => !value || /^(0x)?[a-f0-9]{8,40}$/i.test(value),
      "Enter a valid GPG key fingerprint."
    ),
})

const TIMEZONE_OPTIONS: SelectOption[] = [
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

const LANDING_OPTIONS: SelectOption[] = [
  {
    value: "dashboard",
    label: "Topology Dashboard (/dashboard)",
    description: "Real-time edge cluster topology and mesh health",
  },
  {
    value: "nodes",
    label: "Edge Compute Nodes (/nodes)",
    description: "Compute instances, heartbeats and hardware specs",
  },
  {
    value: "projects",
    label: "Services & Projects (/projects)",
    description: "Active container deployments and git repositories",
  },
  {
    value: "monitor",
    label: "Live Telemetry Monitor (/monitor)",
    description: "Real-time stream logs, traces and metrics",
  },
]

export function ProfileGeneralTab() {
  const { currentUser, updateCurrentUser } = usePlatformData()

  const [name, setName] = React.useState(currentUser.name)
  const [handle, setHandle] = React.useState(currentUser.handle)
  const [email, setEmail] = React.useState(currentUser.email)
  const [title, setTitle] = React.useState(currentUser.title || "")
  const [bio, setBio] = React.useState(currentUser.bio || "")
  const [timezone, setTimezone] = React.useState(currentUser.timezone)
  const [defaultLanding, setDefaultLanding] = React.useState(
    currentUser.defaultLanding || "dashboard"
  )
  const [gpgKeyId, setGpgKeyId] = React.useState(currentUser.gpgKeyId || "")
  const { errors, validate, clearError } = useZodForm(profileSchema)

  const [saved, setSaved] = React.useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validate({
      name,
      handle: handle.trim().replace(/^@/, ""),
      email,
      title,
      bio,
      timezone,
      defaultLanding,
      gpgKeyId,
    })
    if (!valid) return

    updateCurrentUser({
      name: name.trim(),
      handle: handle.trim().replace(/^@/, ""),
      email: email.trim(),
      title: title.trim(),
      bio: bio.trim(),
      timezone,
      defaultLanding,
      gpgKeyId: gpgKeyId.trim(),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Basic Information Section */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <User className="size-4 text-primary" />
                <span>Operator Identity & Role Attributes</span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Personal credentials and metadata visible to other cluster
                operators and logged in audit trails.
              </p>
            </div>
            {saved && (
              <span className="flex animate-in items-center gap-1.5 font-mono text-xs text-emerald-500 fade-in">
                <Check className="size-3.5" />
                <span>Changes Saved</span>
              </span>
            )}
          </div>

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
                <FieldError id="operator-handle-error" className="text-[11px]">
                  {errors.handle}
                </FieldError>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <Field data-invalid={Boolean(errors.title)}>
                <FieldLabel htmlFor="operator-title" className="text-xs">
                  Operational Job Title
                </FieldLabel>
                <Input
                  id="operator-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    clearError("title")
                  }}
                  placeholder="e.g. Principal Infrastructure Architect"
                  aria-invalid={Boolean(errors.title)}
                  aria-describedby={
                    errors.title ? "operator-title-error" : undefined
                  }
                />
                <FieldError id="operator-title-error" className="text-[11px]">
                  {errors.title}
                </FieldError>
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.bio)}>
              <FieldLabel htmlFor="operator-bio" className="text-xs">
                Operator Notes & Specialization
              </FieldLabel>
              <textarea
                id="operator-bio"
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value)
                  clearError("bio")
                }}
                placeholder="Core responsibilities, on-call escalation schedules, or team domain notes..."
                rows={3}
                aria-invalid={Boolean(errors.bio)}
                aria-describedby={errors.bio ? "operator-bio-error" : undefined}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20"
              />
              <FieldError id="operator-bio-error" className="text-[11px]">
                {errors.bio}
              </FieldError>
            </Field>
          </FieldGroup>
        </div>

        {/* Preferences & Development Environment */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
          <div className="border-b border-border pb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="size-4 text-primary" />
              <span>Platform Preferences & Environment</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Customize default routing, display timezones, and cryptographic
              signing keys for deployment commits.
            </p>
          </div>

          <FieldGroup className="gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.timezone)}>
                <FieldLabel htmlFor="operator-timezone" className="text-xs">
                  Operational Timezone
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
                <FieldError
                  id="operator-timezone-error"
                  className="text-[11px]"
                >
                  {errors.timezone}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.defaultLanding)}>
                <FieldLabel htmlFor="default-landing" className="text-xs">
                  Default Console Landing View
                </FieldLabel>
                <SearchableSelect
                  id="default-landing"
                  value={defaultLanding}
                  onChange={(val) => {
                    setDefaultLanding(
                      val as "dashboard" | "nodes" | "projects" | "monitor"
                    )
                    clearError("defaultLanding")
                  }}
                  options={LANDING_OPTIONS}
                  placeholder="Select landing view..."
                  searchPlaceholder="Search views..."
                />
                <FieldError id="default-landing-error" className="text-[11px]">
                  {errors.defaultLanding}
                </FieldError>
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.gpgKeyId)}>
              <FieldLabel
                htmlFor="gpg-key-id"
                className="flex items-center gap-1.5 text-xs"
              >
                <KeyRound className="size-3 text-primary" />
                <span>Git Commit Signing GPG Key Fingerprint</span>
              </FieldLabel>
              <Input
                id="gpg-key-id"
                value={gpgKeyId}
                onChange={(e) => {
                  setGpgKeyId(e.target.value)
                  clearError("gpgKeyId")
                }}
                placeholder="e.g. 0x4A8E9B2F10C8317A"
                aria-invalid={Boolean(errors.gpgKeyId)}
                aria-describedby={
                  errors.gpgKeyId ? "gpg-key-id-error" : undefined
                }
                className="font-mono text-xs"
              />
              <FieldError id="gpg-key-id-error" className="text-[11px]">
                {errors.gpgKeyId}
              </FieldError>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Used to verify deployment provenance and validate automated git
                commit signatures during edge builds.
              </p>
            </Field>
          </FieldGroup>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
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
    </div>
  )
}
