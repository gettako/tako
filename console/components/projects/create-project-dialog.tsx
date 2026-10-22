"use client"

import * as React from "react"
import { FolderPlus } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  type SelectOption,
} from "@/components/ui/searchable-select"
import { usePlatformData } from "@/context/platform-data-context"
import { useZodForm } from "@/hooks/use-zod-form"
import { Project, ProjectEnvironment } from "@/types/platform"

const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Project name must be at least 2 characters.")
    .max(64, "Project name must be 64 characters or fewer."),
  slug: z
    .string()
    .trim()
    .min(1, "Identifier is required.")
    .max(63, "Identifier must be 63 characters or fewer.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and single hyphens only."
    ),
  description: z
    .string()
    .trim()
    .max(240, "Description must be 240 characters or fewer."),
  environment: z.enum(["production", "staging", "preview"]),
  selectedNode: z.string().trim().min(1, "Select a target node."),
})

const ENVIRONMENT_OPTIONS: SelectOption[] = [
  {
    value: "production",
    label: "Production",
    description: "Live edge cluster workload",
  },
  {
    value: "staging",
    label: "Staging",
    description: "Pre-production validation stack",
  },
  {
    value: "preview",
    label: "Preview",
    description: "Ephemeral testing branch",
  },
]

export function CreateProjectDialog({
  children,
  open,
  onOpenChange,
}: {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { addProject, nodes } = usePlatformData()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen

  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [environment, setEnvironment] =
    React.useState<ProjectEnvironment>("production")
  const [selectedNode, setSelectedNode] = React.useState(
    nodes[0]?.id || "node-master-sg"
  )
  const { errors, validate, clearError } = useZodForm(createProjectSchema)

  const nodeOptions: SelectOption[] = React.useMemo(() => {
    if (nodes.length === 0) {
      return [
        {
          value: "node-master-sg",
          label: "node-master-sg (Default Master)",
          description: "142.250.190.46 - Singapore (master)",
        },
      ]
    }
    return nodes.map((n) => ({
      value: n.id,
      label: `${n.name} (${n.location.code})`,
      description: `${n.ipAddress} - ${n.location.name} (${n.role})`,
    }))
  }, [nodes])

  const handleNameChange = (val: string) => {
    setName(val)
    clearError("name")
    clearError("slug")
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    )
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validate({
      name,
      slug,
      description,
      environment,
      selectedNode,
    })
    if (!valid) return

    const newProj: Omit<Project, "id" | "createdAt" | "updatedAt"> = {
      name: name.trim(),
      slug: slug || name.trim().toLowerCase(),
      description:
        description.trim() || "Managed deployment group orchestrated via gRPC",
      environment,
      servicesCount: 0,
      healthyServicesCount: 0,
      targetNodeIds: [selectedNode],
    }

    addProject(newProj)
    setName("")
    setSlug("")
    setDescription("")
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger render={children as React.ReactElement} />}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FolderPlus className="size-5 text-primary" />
            <DialogTitle>Create Project</DialogTitle>
          </div>
          <DialogDescription>
            Group related services, manage environment scopes, and coordinate
            edge node deployment targets.
          </DialogDescription>
        </DialogHeader>

        <form
          id="create-project-form"
          onSubmit={handleCreate}
          noValidate
          className="space-y-4 py-2"
        >
          <FieldGroup className="gap-3">
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel className="text-xs">Project Name</FieldLabel>
              <Input
                required
                placeholder="e.g. Identity Services"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={
                  errors.name ? "create-project-name-error" : undefined
                }
                className="text-xs"
              />
              <FieldError
                id="create-project-name-error"
                className="text-[11px]"
              >
                {errors.name}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.slug)}>
              <FieldLabel className="text-xs">Identifier / Slug</FieldLabel>
              <Input
                required
                placeholder="identity-services"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  clearError("slug")
                }}
                aria-invalid={Boolean(errors.slug)}
                aria-describedby={
                  errors.slug ? "create-project-slug-error" : undefined
                }
                className="font-mono text-xs"
              />
              <FieldError
                id="create-project-slug-error"
                className="text-[11px]"
              >
                {errors.slug}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel className="text-xs">Description</FieldLabel>
              <Input
                placeholder="Brief summary of this workload"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  clearError("description")
                }}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={
                  errors.description
                    ? "create-project-description-error"
                    : undefined
                }
                className="text-xs"
              />
              <FieldError
                id="create-project-description-error"
                className="text-[11px]"
              >
                {errors.description}
              </FieldError>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={Boolean(errors.environment)}>
                <FieldLabel className="text-xs">Environment</FieldLabel>
                <SearchableSelect
                  value={environment}
                  onChange={(val) => {
                    setEnvironment(val as ProjectEnvironment)
                    clearError("environment")
                  }}
                  options={ENVIRONMENT_OPTIONS}
                  placeholder="Select environment..."
                  searchPlaceholder="Filter environment..."
                />
                <FieldError
                  id="create-project-environment-error"
                  className="text-[11px]"
                >
                  {errors.environment}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.selectedNode)}>
                <FieldLabel className="text-xs">Primary Target Node</FieldLabel>
                <SearchableSelect
                  value={selectedNode}
                  onChange={(val) => {
                    setSelectedNode(val)
                    clearError("selectedNode")
                  }}
                  options={nodeOptions}
                  placeholder="Select target node..."
                  searchPlaceholder="Search nodes by name or IP..."
                />
                <FieldError
                  id="create-project-node-error"
                  className="text-[11px]"
                >
                  {errors.selectedNode}
                </FieldError>
              </Field>
            </div>
          </FieldGroup>
        </form>

        <DialogFooter className="gap-2 sm:gap-3">
          <DialogClose
            render={
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            }
          />
          <Button type="submit" form="create-project-form" size="sm">
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
