"use client"

import * as React from "react"
import {
  Boxes,
  ExternalLink,
  Lock,
  Plus,
  Server,
  ShieldAlert,
  Trash2,
  User,
} from "lucide-react"
import { z } from "zod"

import { SettingsSectionHeader } from "@/components/settings/settings-section-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
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
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { usePlatformData } from "@/context/platform-data-context"
import { useZodForm } from "@/hooks/use-zod-form"
import { isValidHostname } from "@/lib/validation"
import { DockerRegistryConfig } from "@/types/platform"

const registrySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters.")
    .max(60, "Display name must be 60 characters or fewer."),
  serverUrl: z
    .string()
    .trim()
    .min(1, "Server URL is required.")
    .refine((value) => {
      const host = value
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        .split(":")[0]
      return isValidHostname(host)
    }, "Enter a valid registry hostname or URL."),
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password or access token is required."),
})

export function RegistriesPanel() {
  const { registries, addDockerRegistry, deleteDockerRegistry } =
    usePlatformData()

  const [addModalOpen, setAddModalOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [serverUrl, setServerUrl] = React.useState("")
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const { errors, validate, clearError, setErrors } = useZodForm(registrySchema)

  const [registryToDelete, setRegistryToDelete] =
    React.useState<DockerRegistryConfig | null>(null)

  const handleOpenAdd = () => {
    setName("")
    setServerUrl("")
    setUsername("")
    setPassword("")
    setErrors({})
    setAddModalOpen(true)
  }

  const applyPreset = (presetName: string, presetUrl: string) => {
    setName(presetName)
    setServerUrl(presetUrl)
    clearError("name")
    clearError("serverUrl")
  }

  const handleCreateRegistry = (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validate({ name, serverUrl, username, password })
    if (!valid) return

    addDockerRegistry({
      name: name.trim(),
      serverUrl: serverUrl.trim(),
      username: username.trim(),
      password: password.trim(),
    })
    setAddModalOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
        <SettingsSectionHeader
          icon={Boxes}
          title="Private Container Registries"
          description="Credentials used by remote edge agents when pulling private Dockerfile base layers or compose images."
          action={
            <Button
              type="button"
              size="sm"
              onClick={handleOpenAdd}
              className="gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              <span>Connect Registry</span>
            </Button>
          }
        />

        {registries.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-dashed border-border px-4 py-12 text-center">
            <Boxes className="mx-auto size-10 text-muted-foreground/60" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                No private registries configured
              </p>
              <p className="mx-auto max-w-sm text-xs text-muted-foreground">
                Connect private container registries (GHCR, Docker Hub, Quay) to
                deploy proprietary containers directly.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenAdd}
              className="mt-2 gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              <span>Connect your first registry</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {registries.map((reg) => (
              <div
                key={reg.id}
                className="flex flex-col justify-between space-y-3 rounded-lg border border-border bg-muted/10 p-4 transition-colors hover:border-border/80"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Server className="size-3.5 shrink-0 text-primary" />
                      <span>{reg.name}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setRegistryToDelete(reg)}
                      className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Delete Registry"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-1 font-mono text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 truncate">
                      <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                      <span className="text-foreground">{reg.serverUrl}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="size-3 shrink-0 text-muted-foreground" />
                      <span>{reg.username}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lock className="size-3 shrink-0 text-muted-foreground" />
                      <span className="tracking-widest text-muted-foreground">
                        ••••••••••••
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-2 font-mono text-[11px] text-muted-foreground">
                  <span>ID: {reg.id}</span>
                  <span>{reg.createdAt}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Registry Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="size-4 shrink-0 text-primary" />
              <span>Connect Private Container Registry</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide credentials for pulling private images directly during
              edge node builds.
            </DialogDescription>
          </DialogHeader>

          {/* Quick Presets */}
          <div className="space-y-1.5 text-xs">
            <span className="block text-[11px] font-medium text-muted-foreground">
              Quick Presets:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  applyPreset("GitHub Container Registry", "ghcr.io")
                }
                className="rounded border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary hover:text-primary"
              >
                ghcr.io (GitHub)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("Docker Hub Private", "docker.io")}
                className="rounded border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary hover:text-primary"
              >
                docker.io (Docker Hub)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("Quay.io Registry", "quay.io")}
                className="rounded border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary hover:text-primary"
              >
                quay.io (Red Hat)
              </button>
            </div>
          </div>

          <form
            onSubmit={handleCreateRegistry}
            noValidate
            className="space-y-4 pt-1"
          >
            <FieldGroup className="gap-3">
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel className="text-xs">Display Name</FieldLabel>
                <Input
                  placeholder="e.g. GitHub Packages or Docker Hub Private"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    clearError("name")
                  }}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={
                    errors.name ? "registry-name-error" : undefined
                  }
                  className="text-xs"
                />
                <FieldError id="registry-name-error" className="text-[11px]">
                  {errors.name}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.serverUrl)}>
                <FieldLabel className="text-xs">Server URL</FieldLabel>
                <Input
                  placeholder="e.g. ghcr.io or docker.io"
                  value={serverUrl}
                  onChange={(e) => {
                    setServerUrl(e.target.value)
                    clearError("serverUrl")
                  }}
                  aria-invalid={Boolean(errors.serverUrl)}
                  aria-describedby={
                    errors.serverUrl ? "registry-url-error" : undefined
                  }
                  className="font-mono text-xs"
                />
                <FieldError id="registry-url-error" className="text-[11px]">
                  {errors.serverUrl}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.username)}>
                <FieldLabel className="text-xs">
                  Username / Access Key
                </FieldLabel>
                <Input
                  placeholder="e.g. octocat or deployer"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    clearError("username")
                  }}
                  aria-invalid={Boolean(errors.username)}
                  aria-describedby={
                    errors.username ? "registry-username-error" : undefined
                  }
                  className="font-mono text-xs"
                />
                <FieldError
                  id="registry-username-error"
                  className="text-[11px]"
                >
                  {errors.username}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.password)}>
                <FieldLabel className="text-xs">
                  Password / Personal Access Token
                </FieldLabel>
                <Input
                  type="password"
                  placeholder="••••••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    clearError("password")
                  }}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password ? "registry-password-error" : undefined
                  }
                  className="font-mono text-xs"
                />
                <FieldError
                  id="registry-password-error"
                  className="text-[11px]"
                >
                  {errors.password}
                </FieldError>
              </Field>
            </FieldGroup>

            <DialogFooter className="gap-2 pt-2 sm:gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="gap-1.5 text-xs">
                <Boxes className="size-3.5" />
                <span>Connect Registry</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Registry Confirmation Dialog */}
      <Dialog
        open={!!registryToDelete}
        onOpenChange={(open) => !open && setRegistryToDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <span>Delete Container Registry</span>
            </DialogTitle>
            <DialogDescription className="pt-1 text-xs leading-relaxed">
              Are you sure you want to remove &ldquo;{registryToDelete?.name}
              &rdquo;? Worker daemons will no longer be able to pull images
              using these credentials.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRegistryToDelete(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                if (registryToDelete) {
                  deleteDockerRegistry(registryToDelete.id)
                  setRegistryToDelete(null)
                }
              }}
              className="gap-1.5 text-xs"
            >
              <Trash2 className="size-3.5" />
              <span>Confirm Delete</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
