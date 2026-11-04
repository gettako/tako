"use client"

import * as React from "react"
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FolderOpen,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  Server,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CodeEditor } from "@/components/ui/code-editor"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NODE_ROLE, type ClusterNode } from "@/types/platform"
import {
  useDeleteNodeTraefikFile,
  useNodeTraefikFile,
  useNodeTraefikFiles,
  useReloadNodeTraefik,
  useSaveNodeTraefikFile,
} from "@/hooks/use-domain"
import {
  DEFAULT_TAKO_CONSOLE_YAML,
  DEFAULT_TRAEFIK_STATIC_YAML,
  NEW_FILE_STARTER_TEMPLATE,
  type TraefikConfigFileFull,
  type TraefikConfigFileMeta,
} from "@/services/domain.service"
import { cn } from "@/lib/utils"

interface NodeTraefikConfigViewProps {
  node: ClusterNode
  actorName: string
  onAuditLog?: (action: string, target: string, details: string) => void
}

export function NodeTraefikConfigView({
  node,
  actorName: _actorName,
  onAuditLog,
}: NodeTraefikConfigViewProps) {
  const isMaster = node.role === NODE_ROLE.MASTER

  const {
    data: rawFiles = [],
    isLoading: isLoadingList,
    refetch: fetchFiles,
  } = useNodeTraefikFiles(node.id)

  const files = React.useMemo(() => {
    return isMaster ? rawFiles : rawFiles.filter((f) => f.name !== "tako.yml")
  }, [rawFiles, isMaster])

  const [selectedFileName, setSelectedFileName] =
    React.useState<string>("traefik.yml")

  React.useEffect(() => {
    if (files.length > 0 && !files.some((f) => f.name === selectedFileName)) {
      setSelectedFileName(files[0].name)
    }
  }, [files, selectedFileName])

  const { data: fileData, isLoading: isLoadingFile } = useNodeTraefikFile(
    node.id,
    selectedFileName
  )

  const [fileContent, setFileContent] = React.useState<string>("")
  const [savedContent, setSavedContent] = React.useState<string>("")

  React.useEffect(() => {
    if (fileData) {
      setFileContent(fileData.content ?? "")
      setSavedContent(fileData.content ?? "")
    }
  }, [fileData])

  const saveFileMutation = useSaveNodeTraefikFile(node.id)
  const deleteFileMutation = useDeleteNodeTraefikFile(node.id)
  const reloadMutation = useReloadNodeTraefik(node.id)

  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [reloadSuccess, setReloadSuccess] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Dynamic directory collapse toggle
  const [isDynamicOpen, setIsDynamicOpen] = React.useState(true)

  // Create new file modal state
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [newFileName, setNewFileName] = React.useState("")
  const [createError, setCreateError] = React.useState<string | null>(null)

  const isDirty = fileContent !== savedContent
  const isSaving = saveFileMutation.isPending
  const isReloading = reloadMutation.isPending

  const selectedFileMeta = React.useMemo(() => {
    return files.find((f) => f.name === selectedFileName)
  }, [files, selectedFileName])

  const handleSave = async () => {
    if (!selectedFileName) return
    setErrorMessage(null)
    try {
      await saveFileMutation.mutateAsync({
        fileName: selectedFileName,
        content: fileContent,
      })
      setSavedContent(fileContent)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)

      onAuditLog?.(
        "Traefik File Saved",
        `${node.name} (${selectedFileName})`,
        `Updated Traefik configuration file ${selectedFileName} on ${node.ipAddress}`
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save file"
      setErrorMessage(msg)
    }
  }

  const handleReload = async () => {
    setErrorMessage(null)
    try {
      await reloadMutation.mutateAsync()
      setReloadSuccess(true)
      setTimeout(() => setReloadSuccess(false), 3000)

      onAuditLog?.(
        "Traefik Reload Dispatched",
        node.name,
        `Reloaded Traefik dynamic provider and ingress routers on ${node.ipAddress}`
      )
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reload Traefik"
      setErrorMessage(msg)
    }
  }

  const handleDeleteFile = async (filename: string) => {
    if (filename === "traefik.yml") return
    if (
      !confirm(
        `Are you sure you want to delete ${filename}? This action will immediately remove its routing rules from Traefik.`
      )
    ) {
      return
    }

    try {
      await deleteFileMutation.mutateAsync(filename)
      onAuditLog?.(
        "Traefik File Deleted",
        `${node.name} (${filename})`,
        `Deleted Traefik dynamic configuration file ${filename} on ${node.ipAddress}`
      )
      setSelectedFileName("traefik.yml")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete file"
      alert(msg)
    }
  }

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault()
    let cleanName = newFileName.trim()
    if (!cleanName) return

    if (!cleanName.endsWith(".yml") && !cleanName.endsWith(".yaml")) {
      cleanName += ".yml"
    }

    if (files.some((f) => f.name.toLowerCase() === cleanName.toLowerCase())) {
      setCreateError(`File "${cleanName}" already exists.`)
      return
    }

    try {
      await saveFileMutation.mutateAsync({
        fileName: cleanName,
        content: NEW_FILE_STARTER_TEMPLATE,
      })
      setIsCreateOpen(false)
      setNewFileName("")
      setCreateError(null)
      setSelectedFileName(cleanName)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create file"
      setCreateError(msg)
    }
  }

  const dynamicFiles = React.useMemo(() => {
    return files.filter((f) => f.name !== "traefik.yml")
  }, [files])

  return (
    <div className="space-y-4">
      {/* Top Banner & Overview */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Server className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Traefik Ingress & Configuration Manager
            </h3>
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
              v3.x File Provider
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Manage static entrypoints and live dynamic routing configurations
            deployed on this edge node.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void fetchFiles()}
            disabled={isLoadingList}
            className="gap-1.5 text-xs"
            title="Refresh files"
          >
            <RefreshCw
              className={cn("size-3.5", isLoadingList && "animate-spin")}
            />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleReload}
            disabled={isReloading}
            className="gap-1.5 text-xs text-foreground hover:bg-muted"
            title="Trigger Traefik dynamic provider reload"
          >
            <RotateCw
              className={cn(
                "size-3.5",
                isReloading && "animate-spin text-primary"
              )}
            />
            <span>{reloadSuccess ? "Reloaded!" : "Reload Traefik"}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setNewFileName("")
              setCreateError(null)
              setIsCreateOpen(true)
            }}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            <span>New Dynamic File</span>
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Two-Column File Manager + Editor View */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Column: File Explorer (Tree) */}
        <div className="rounded-lg border border-border bg-card p-3 lg:col-span-4 xl:col-span-3">
          <div className="mb-2.5 flex items-center justify-between border-b border-border pb-2">
            <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Files Explorer
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
          </div>

          <div className="space-y-1 font-mono text-xs">
            {/* Root Static: traefik.yml */}
            <button
              type="button"
              onClick={() => setSelectedFileName("traefik.yml")}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors",
                selectedFileName === "traefik.yml"
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-foreground hover:bg-muted/60"
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">traefik.yml</span>
              </div>
              <span className="py-0.2 shrink-0 rounded border border-border bg-muted px-1.5 text-[9px] font-normal text-muted-foreground uppercase">
                Static
              </span>
            </button>

            {/* Folder: dynamic/ */}
            <div className="pt-1.5">
              <button
                type="button"
                onClick={() => setIsDynamicOpen((prev) => !prev)}
                className="flex w-full items-center gap-1.5 px-1 py-1 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {isDynamicOpen ? (
                  <ChevronDown className="size-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-3 text-muted-foreground" />
                )}
                {isDynamicOpen ? (
                  <FolderOpen className="size-3.5 text-amber-500" />
                ) : (
                  <Folder className="size-3.5 text-amber-500" />
                )}
                <span className="font-semibold">dynamic/</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  ({dynamicFiles.length})
                </span>
              </button>

              {isDynamicOpen && (
                <div className="mt-1 space-y-0.5 border-l border-border/80 pl-3.5">
                  {dynamicFiles.length === 0 ? (
                    <div className="py-2 text-[11px] text-muted-foreground italic">
                      No dynamic files yet
                    </div>
                  ) : (
                    dynamicFiles.map((file) => {
                      const isSelected = selectedFileName === file.name
                      const isTako = file.name === "tako.yml"

                      return (
                        <div
                          key={file.name}
                          className={cn(
                            "group flex w-full items-center justify-between rounded-md px-2 py-1.5 transition-colors",
                            isSelected
                              ? "bg-primary/10 font-semibold text-primary"
                              : "text-foreground hover:bg-muted/60"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedFileName(file.name)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate text-xs">
                              {file.name}
                            </span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            {isTako ? (
                              <span className="py-0.2 shrink-0 rounded border border-primary/30 bg-primary/10 px-1 text-[9px] font-normal text-primary">
                                Console
                              </span>
                            ) : (
                              <span className="py-0.2 shrink-0 rounded border border-border bg-muted px-1 text-[9px] font-normal text-muted-foreground">
                                Service
                              </span>
                            )}

                            {!isTako && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteFile(file.name)
                                }}
                                className="hidden text-muted-foreground opacity-60 group-hover:block hover:text-destructive"
                                title={`Delete ${file.name}`}
                              >
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Code Editor */}
        <div className="flex flex-col rounded-lg border border-border bg-card lg:col-span-8 xl:col-span-9">
          {/* Editor Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileCode2 className="size-4 text-primary" />
                <span className="font-mono text-xs font-semibold text-foreground">
                  {selectedFileMeta?.path ||
                    (selectedFileName === "traefik.yml"
                      ? "/etc/tako/traefik/traefik.yml"
                      : `/etc/tako/traefik/dynamic/${selectedFileName}`)}
                </span>
                {isDirty && (
                  <span className="py-0.2 rounded bg-amber-500/10 px-1.5 font-mono text-[10px] font-medium text-amber-500">
                    Unsaved
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                <span>
                  {selectedFileName === "traefik.yml"
                    ? "Static Core Spec (Read/Write)"
                    : selectedFileName === "tako.yml"
                      ? "Console Dynamic Ingress"
                      : "Service Dynamic Ingress"}
                </span>
                {selectedFileMeta?.size !== undefined && (
                  <>
                    <span>•</span>
                    <span>{(selectedFileMeta.size / 1024).toFixed(1)} KB</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                className="gap-1.5 text-xs"
              >
                {saveSuccess ? (
                  <>
                    <Check className="size-3.5 text-emerald-300" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    <span>{isSaving ? "Saving..." : "Save File"}</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Editor Container */}
          <div className="p-3">
            {isLoadingFile ? (
              <div className="flex min-h-[350px] items-center justify-center font-mono text-xs text-muted-foreground">
                <RefreshCw className="mr-2 size-4 animate-spin text-primary" />
                Loading {selectedFileName}...
              </div>
            ) : (
              <CodeEditor
                value={fileContent}
                onChange={setFileContent}
                language="yaml"
                minHeight="min-h-[420px]"
                maxHeight="max-h-[600px]"
                showLineNumbers={true}
                showCopy={true}
                showSave={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* Dialog: Create New Dynamic Config File */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateFile}>
            <DialogHeader>
              <DialogTitle>New Traefik Dynamic File</DialogTitle>
              <DialogDescription>
                Create a new dynamic YAML file in{" "}
                <code className="font-mono text-foreground">
                  /etc/tako/traefik/dynamic/
                </code>{" "}
                for service routing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="dynamic-config-filename"
                  className="font-mono text-xs font-medium text-foreground"
                >
                  File Name
                </label>
                <div className="flex items-center gap-1 font-mono text-xs">
                  <span className="text-muted-foreground">./dynamic/</span>
                  <Input
                    id="dynamic-config-filename"
                    placeholder="project-service.yml"
                    value={newFileName}
                    onChange={(e) => {
                      setNewFileName(e.target.value)
                      setCreateError(null)
                    }}
                    className="font-mono text-xs"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Suggested format:{" "}
                  <code className="text-foreground">
                    &lt;project&gt;-&lt;service&gt;.yml
                  </code>
                </p>
              </div>

              {createError && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!newFileName.trim()}>
                Create File
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
