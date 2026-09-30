"use client"

import * as React from "react"
import { SettingsHeader } from "@/components/settings-header"
import {
  BellIcon,
  DiscordLogoIcon,
  TelegramLogoIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  TrashIcon,
  PencilSimpleIcon,
  CheckIcon,
  WarningIcon,
  CircleNotchIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  api,
  ApiError,
  type NotificationChannel,
  type CreateNotificationChannelRequest,
  type UpdateNotificationChannelRequest,
} from "@/lib/api"
import { cn } from "@/lib/utils"

export default function SettingsNotificationsPage() {
  const [channels, setChannels] = React.useState<NotificationChannel[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Test notification loading map per channel ID
  const [testingMap, setTestingMap] = React.useState<Record<string, boolean>>(
    {}
  )

  // Dialog state
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [editingChannel, setEditingChannel] =
    React.useState<NotificationChannel | null>(null)
  const [deletingChannel, setDeletingChannel] =
    React.useState<NotificationChannel | null>(null)

  // Form states for Add/Edit
  const [formType, setFormType] = React.useState<"discord" | "telegram">(
    "discord"
  )
  const [formName, setFormName] = React.useState("")
  const [formWebhookUrl, setFormWebhookUrl] = React.useState("")
  const [formBotToken, setFormBotToken] = React.useState("")
  const [formChatId, setFormChatId] = React.useState("")
  const [formOnDeploySuccess, setFormOnDeploySuccess] = React.useState(true)
  const [formOnDeployFailed, setFormOnDeployFailed] = React.useState(true)
  const [formOnContainerCrashed, setFormOnContainerCrashed] =
    React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const loadChannels = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.notifications.list()
      setChannels(data)
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load notification channels."
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadChannels()
  }, [loadChannels])

  const openAddDialog = () => {
    setFormType("discord")
    setFormName("")
    setFormWebhookUrl("")
    setFormBotToken("")
    setFormChatId("")
    setFormOnDeploySuccess(true)
    setFormOnDeployFailed(true)
    setFormOnContainerCrashed(true)
    setFormError(null)
    setIsAddOpen(true)
  }

  const openEditDialog = (channel: NotificationChannel) => {
    setEditingChannel(channel)
    setFormType(channel.type)
    setFormName(channel.name)
    setFormWebhookUrl(channel.webhook_url || "")
    setFormBotToken(channel.bot_token || "")
    setFormChatId(channel.chat_id || "")
    setFormOnDeploySuccess(channel.on_deploy_success)
    setFormOnDeployFailed(channel.on_deploy_failed)
    setFormOnContainerCrashed(channel.on_container_crashed)
    setFormError(null)
  }

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      setFormError("Channel name is required.")
      return
    }

    if (formType === "discord") {
      if (!formWebhookUrl.trim()) {
        setFormError("Discord Webhook URL is required.")
        return
      }
      if (
        !formWebhookUrl.startsWith("https://discord.com/api/webhooks/") &&
        !formWebhookUrl.startsWith("https://discordapp.com/api/webhooks/")
      ) {
        setFormError(
          "Please enter a valid Discord webhook URL (starts with https://discord.com/api/webhooks/)."
        )
        return
      }
    } else {
      if (!formBotToken.trim()) {
        setFormError("Telegram Bot Token is required.")
        return
      }
      if (!formChatId.trim()) {
        setFormError("Telegram Chat ID is required.")
        return
      }
    }

    setIsSubmitting(true)
    setFormError(null)

    try {
      if (editingChannel) {
        const updatePayload: UpdateNotificationChannelRequest = {
          name: formName.trim(),
          webhook_url:
            formType === "discord" ? formWebhookUrl.trim() : undefined,
          bot_token: formType === "telegram" ? formBotToken.trim() : undefined,
          chat_id: formType === "telegram" ? formChatId.trim() : undefined,
          on_deploy_success: formOnDeploySuccess,
          on_deploy_failed: formOnDeployFailed,
          on_container_crashed: formOnContainerCrashed,
        }
        const updated = await api.notifications.update(
          editingChannel.id,
          updatePayload
        )
        setChannels((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        )
        setFeedback({
          type: "success",
          message: `Channel "${updated.name}" updated successfully.`,
        })
        setEditingChannel(null)
      } else {
        const createPayload: CreateNotificationChannelRequest = {
          type: formType,
          name: formName.trim(),
          enabled: true,
          webhook_url:
            formType === "discord" ? formWebhookUrl.trim() : undefined,
          bot_token: formType === "telegram" ? formBotToken.trim() : undefined,
          chat_id: formType === "telegram" ? formChatId.trim() : undefined,
          on_deploy_success: formOnDeploySuccess,
          on_deploy_failed: formOnDeployFailed,
          on_container_crashed: formOnContainerCrashed,
        }
        const created = await api.notifications.create(createPayload)
        setChannels((prev) => [created, ...prev])
        setFeedback({
          type: "success",
          message: `Channel "${created.name}" configured successfully.`,
        })
        setIsAddOpen(false)
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to save channel."
      setFormError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleEnabled = async (channel: NotificationChannel) => {
    const newEnabled = !channel.enabled
    // Optimistic update
    setChannels((prev) =>
      prev.map((c) => (c.id === channel.id ? { ...c, enabled: newEnabled } : c))
    )
    try {
      await api.notifications.update(channel.id, { enabled: newEnabled })
      setFeedback({
        type: "success",
        message: `Channel "${channel.name}" ${newEnabled ? "enabled" : "disabled"}.`,
      })
    } catch (err) {
      // Revert on error
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channel.id ? { ...c, enabled: !newEnabled } : c
        )
      )
      setFeedback({
        type: "error",
        message: "Failed to toggle channel status.",
      })
    }
  }

  const handleToggleEvent = async (
    channel: NotificationChannel,
    eventKey: "on_deploy_success" | "on_deploy_failed" | "on_container_crashed",
    currentVal: boolean
  ) => {
    const updatedVal = !currentVal
    // Optimistic update
    setChannels((prev) =>
      prev.map((c) =>
        c.id === channel.id ? { ...c, [eventKey]: updatedVal } : c
      )
    )
    try {
      await api.notifications.update(channel.id, {
        [eventKey]: updatedVal,
      })
    } catch {
      // Revert
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channel.id ? { ...c, [eventKey]: currentVal } : c
        )
      )
      setFeedback({
        type: "error",
        message: "Failed to update notification event setting.",
      })
    }
  }

  const handleSendTestNotification = async (channel: NotificationChannel) => {
    setTestingMap((prev) => ({ ...prev, [channel.id]: true }))
    setFeedback(null)
    try {
      await api.notifications.test(channel.id)
      setFeedback({
        type: "success",
        message: `Test notification sent to "${channel.name}". Check your ${channel.type === "discord" ? "Discord channel" : "Telegram chat"}.`,
      })
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to send test notification."
      setFeedback({
        type: "error",
        message: msg,
      })
    } finally {
      setTestingMap((prev) => ({ ...prev, [channel.id]: false }))
    }
  }

  const handleDeleteChannel = async () => {
    if (!deletingChannel) return
    setIsSubmitting(true)
    try {
      await api.notifications.delete(deletingChannel.id)
      setChannels((prev) => prev.filter((c) => c.id !== deletingChannel.id))
      setFeedback({
        type: "success",
        message: `Channel "${deletingChannel.name}" deleted.`,
      })
      setDeletingChannel(null)
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to delete channel."
      setFeedback({ type: "error", message: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      <SettingsHeader
        title="Notification Settings"
        description="Configure administrator profile, security, and notification alerts."
        action={
          <Button onClick={openAddDialog} className="gap-2">
            <PlusIcon className="size-4" />
            <span>Add Channel</span>
          </Button>
        }
      />

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          className={cn(
            "flex items-center justify-between rounded-lg border px-4 py-3 text-xs",
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircleIcon className="size-4 shrink-0" />
            ) : (
              <WarningIcon className="size-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100"
            aria-label="Dismiss message"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* State 1: Loading State */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 animate-pulse rounded-md bg-muted" />
                  <div className="flex flex-col gap-1.5">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                  </div>
                </div>
                <div className="h-6 w-16 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-20 animate-pulse rounded-md bg-muted/40" />
              <div className="h-9 w-32 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {/* State 2: Error State */}
      {!isLoading && error && (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center"
        >
          <WarningIcon className="size-8 text-destructive" />
          <div className="flex flex-col gap-1">
            <h3 className="font-heading text-sm font-semibold text-foreground">
              Unable to Load Notification Channels
            </h3>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadChannels}
            className="mt-2 text-xs"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* State 3: Empty State */}
      {!isLoading && !error && channels.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
            <BellIcon className="size-6" />
          </div>
          <div className="max-w-md">
            <h2 className="font-heading text-base font-semibold text-foreground">
              No Notification Channels Configured
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Add Discord webhooks or Telegram bot credentials to receive
              instant alerts whenever deployments succeed, builds fail, or
              containers crash.
            </p>
          </div>
          <Button onClick={openAddDialog} size="sm" className="gap-1.5 text-xs">
            <PlusIcon className="size-4" />
            <span>Add First Channel</span>
          </Button>
        </div>
      )}

      {/* State 4: Data State */}
      {!isLoading && !error && channels.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {channels.map((ch) => {
            const isDiscord = ch.type === "discord"
            const isTesting = testingMap[ch.id] || false

            return (
              <div
                key={ch.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-card p-6"
              >
                <div className="flex flex-col gap-4">
                  {/* Top Header: Icon, Name, Type, and Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-md border",
                          isDiscord
                            ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                            : "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                        )}
                      >
                        {isDiscord ? (
                          <DiscordLogoIcon className="size-5" />
                        ) : (
                          <TelegramLogoIcon className="size-5" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <h2 className="font-heading text-sm font-semibold text-foreground">
                            {ch.name}
                          </h2>
                          <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-3xs text-muted-foreground uppercase">
                            {ch.type}
                          </span>
                        </div>
                        <p className="max-w-50 truncate font-mono text-xs text-muted-foreground sm:max-w-xs">
                          {isDiscord
                            ? ch.webhook_url
                              ? `${ch.webhook_url.slice(0, 36)}...`
                              : "No webhook URL"
                            : ch.chat_id
                              ? `Chat ID: ${ch.chat_id}`
                              : "No chat ID"}
                        </p>
                      </div>
                    </div>

                    {/* Enable / Disable Pill Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleEnabled(ch)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-2xs font-medium transition-colors",
                        ch.enabled
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                          : "border-border bg-muted/60 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          ch.enabled ? "bg-emerald-500" : "bg-zinc-400"
                        )}
                      />
                      <span>{ch.enabled ? "Active" : "Disabled"}</span>
                    </button>
                  </div>

                  {/* Event Checkboxes */}
                  <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3 text-xs">
                    <span className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
                      Event Triggers
                    </span>

                    <label className="flex cursor-pointer items-center gap-2.5">
                      <Checkbox
                        checked={ch.on_deploy_success}
                        onCheckedChange={() =>
                          handleToggleEvent(
                            ch,
                            "on_deploy_success",
                            ch.on_deploy_success
                          )
                        }
                      />
                      <span className="text-xs text-foreground">
                        Deploy Succeeded (healthy container)
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2.5">
                      <Checkbox
                        checked={ch.on_deploy_failed}
                        onCheckedChange={() =>
                          handleToggleEvent(
                            ch,
                            "on_deploy_failed",
                            ch.on_deploy_failed
                          )
                        }
                      />
                      <span className="text-xs text-foreground">
                        Deploy Failed (build or health check error)
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2.5">
                      <Checkbox
                        checked={ch.on_container_crashed}
                        onCheckedChange={() =>
                          handleToggleEvent(
                            ch,
                            "on_container_crashed",
                            ch.on_container_crashed
                          )
                        }
                      />
                      <span className="text-xs text-foreground">
                        Container Crashed (unexpected exit or restart)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendTestNotification(ch)}
                    disabled={isTesting || !ch.enabled}
                    className="h-9 gap-1.5 text-xs"
                  >
                    {isTesting ? (
                      <>
                        <CircleNotchIcon className="size-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <PaperPlaneTiltIcon className="size-3.5" />
                        <span>Send Test Notification</span>
                      </>
                    )}
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditDialog(ch)}
                      aria-label={`Edit ${ch.name}`}
                    >
                      <PencilSimpleIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeletingChannel(ch)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${ch.name}`}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Channel Dialog */}
      <Dialog
        open={isAddOpen || editingChannel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false)
            setEditingChannel(null)
          }
        }}
      >
        <DialogContent size="lg">
          <form onSubmit={handleSaveChannel} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>
                {editingChannel
                  ? "Edit Notification Channel"
                  : "Add Notification Channel"}
              </DialogTitle>
              <DialogDescription>
                Configure incoming webhook or bot credentials for deployment
                alerts.
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                <WarningIcon className="size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Type selector (only for Add) */}
            {!editingChannel && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground">
                  Channel Platform
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType("discord")}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-md border p-2.5 text-xs font-medium transition-colors",
                      formType === "discord"
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    )}
                  >
                    <DiscordLogoIcon className="size-4" />
                    <span>Discord</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("telegram")}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-md border p-2.5 text-xs font-medium transition-colors",
                      formType === "telegram"
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    )}
                  >
                    <TelegramLogoIcon className="size-4" />
                    <span>Telegram</span>
                  </button>
                </div>
              </div>
            )}

            {/* Channel Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="channel-name"
                className="text-xs font-medium text-foreground"
              >
                Channel Name
              </label>
              <Input
                id="channel-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={
                  formType === "discord"
                    ? "Discord Deployments"
                    : "Telegram Alerts"
                }
                className="h-9 text-xs"
                required
              />
            </div>

            {/* Discord Webhook URL */}
            {formType === "discord" && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="webhook-url"
                  className="text-xs font-medium text-foreground"
                >
                  Discord Webhook URL
                </label>
                <Input
                  id="webhook-url"
                  type="url"
                  value={formWebhookUrl}
                  onChange={(e) => setFormWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="h-9 font-mono text-xs"
                  required
                />
                <p className="text-2xs text-muted-foreground">
                  Obtained from Discord Channel Settings &gt; Integrations &gt;
                  Webhooks.
                </p>
              </div>
            )}

            {/* Telegram Fields */}
            {formType === "telegram" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="bot-token"
                    className="text-xs font-medium text-foreground"
                  >
                    Telegram Bot Token
                  </label>
                  <Input
                    id="bot-token"
                    type="password"
                    value={formBotToken}
                    onChange={(e) => setFormBotToken(e.target.value)}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="h-9 font-mono text-xs"
                    required
                  />
                  <p className="text-2xs text-muted-foreground">
                    Created via @BotFather on Telegram.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="chat-id"
                    className="text-xs font-medium text-foreground"
                  >
                    Telegram Chat ID
                  </label>
                  <Input
                    id="chat-id"
                    value={formChatId}
                    onChange={(e) => setFormChatId(e.target.value)}
                    placeholder="-1001234567890 or @channelusername"
                    className="h-9 font-mono text-xs"
                    required
                  />
                  <p className="text-2xs text-muted-foreground">
                    Numeric group or channel ID, or public username with leading
                    @.
                  </p>
                </div>
              </>
            )}

            {/* Event Checkboxes */}
            <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
              <span className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
                Notify On Events
              </span>

              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={formOnDeploySuccess}
                  onCheckedChange={(checked) =>
                    setFormOnDeploySuccess(checked === true)
                  }
                />
                <span className="text-xs text-foreground">
                  Deploy Succeeded (healthy container)
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={formOnDeployFailed}
                  onCheckedChange={(checked) =>
                    setFormOnDeployFailed(checked === true)
                  }
                />
                <span className="text-xs text-foreground">
                  Deploy Failed (build or health check error)
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={formOnContainerCrashed}
                  onCheckedChange={(checked) =>
                    setFormOnContainerCrashed(checked === true)
                  }
                />
                <span className="text-xs text-foreground">
                  Container Crashed (unexpected exit or restart)
                </span>
              </label>
            </div>

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAddOpen(false)
                  setEditingChannel(null)
                }}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="gap-1.5 text-xs"
              >
                {isSubmitting ? (
                  <>
                    <CircleNotchIcon className="size-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>
                    {editingChannel ? "Save Changes" : "Create Channel"}
                  </span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deletingChannel !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingChannel(null)
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Delete Notification Channel</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the channel &quot;
              {deletingChannel?.name}&quot;? Alerts will no longer be dispatched
              to this destination.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingChannel(null)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteChannel}
              disabled={isSubmitting}
              className="gap-1.5 text-xs"
            >
              {isSubmitting ? (
                <>
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete Channel</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
