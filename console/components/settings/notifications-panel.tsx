"use client"

import * as React from "react"
import { Bell, Check, Mail, MessageSquare, Save, Send } from "lucide-react"
import { z } from "zod"

import { SettingsSectionHeader } from "@/components/settings/settings-section-header"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { usePlatformData } from "@/context/platform-data-context"
import { useZodForm } from "@/hooks/use-zod-form"
import { isHttpUrl } from "@/lib/validation"

const notificationsSchema = z
  .object({
    notificationsEnabled: z.boolean(),
    emailAlertsEnabled: z.boolean(),
    telegramEnabled: z.boolean(),
    discordWebhook: z
      .string()
      .trim()
      .refine(
        (value) => !value || isHttpUrl(value),
        "Enter a valid Discord webhook URL."
      ),
    slackWebhook: z
      .string()
      .trim()
      .refine(
        (value) => !value || isHttpUrl(value),
        "Enter a valid Slack webhook URL."
      ),
    alertEmail: z.string().trim(),
    smtpHost: z.string().trim(),
    smtpPort: z.string().trim(),
    telegramBotToken: z.string().trim(),
    telegramChatId: z.string().trim(),
  })
  .superRefine((values, context) => {
    if (!values.notificationsEnabled) return

    if (values.emailAlertsEnabled) {
      if (!values.alertEmail) {
        context.addIssue({
          code: "custom",
          path: ["alertEmail"],
          message: "Alert recipient email is required.",
        })
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.alertEmail)) {
        context.addIssue({
          code: "custom",
          path: ["alertEmail"],
          message: "Enter a valid email address.",
        })
      }

      if (!values.smtpHost) {
        context.addIssue({
          code: "custom",
          path: ["smtpHost"],
          message: "SMTP host is required.",
        })
      }

      if (!/^\d+$/.test(values.smtpPort)) {
        context.addIssue({
          code: "custom",
          path: ["smtpPort"],
          message: "SMTP port must be a number.",
        })
      } else {
        const port = Number(values.smtpPort)
        if (port < 1 || port > 65535) {
          context.addIssue({
            code: "custom",
            path: ["smtpPort"],
            message: "SMTP port must be between 1 and 65535.",
          })
        }
      }
    }

    if (values.telegramEnabled) {
      if (!values.telegramBotToken) {
        context.addIssue({
          code: "custom",
          path: ["telegramBotToken"],
          message: "Bot API token is required.",
        })
      }
      if (!values.telegramChatId) {
        context.addIssue({
          code: "custom",
          path: ["telegramChatId"],
          message: "Chat or channel ID is required.",
        })
      }
    }
  })

export function NotificationsPanel() {
  const { settings, updateSettings, addAuditLog, testNotifications } =
    usePlatformData()

  const [notificationsEnabled, setNotificationsEnabled] = React.useState(
    settings.notificationsEnabled ?? true
  )
  const [discordWebhook, setDiscordWebhook] = React.useState(
    settings.webhookUrl || ""
  )
  const [slackWebhook, setSlackWebhook] = React.useState(
    settings.slackWebhookUrl ||
      "https://hooks.slack.com/services/T00000000/B00000000/XXXXX"
  )
  const [emailAlerts, setEmailAlerts] = React.useState(
    settings.emailAlertsEnabled ?? true
  )
  const [alertEmail, setAlertEmail] = React.useState(
    settings.alertEmail || "operator@gettako.dev"
  )
  const [smtpHost, setSmtpHost] = React.useState(
    settings.smtpHost || "smtp.mailgun.org"
  )
  const [smtpPort, setSmtpPort] = React.useState(
    (settings.smtpPort || 587).toString()
  )
  const [telegramEnabled, setTelegramEnabled] = React.useState(
    settings.telegramEnabled ?? false
  )
  const [telegramBotToken, setTelegramBotToken] = React.useState(
    settings.telegramBotToken || ""
  )
  const [telegramChatId, setTelegramChatId] = React.useState(
    settings.telegramChatId || ""
  )
  const { errors, validate, clearError } = useZodForm(notificationsSchema)

  // Event Subscriptions
  const [notifyOnOutage, setNotifyOnOutage] = React.useState(
    settings.notifyOnOutage ?? true
  )
  const [notifyOnDeployFail, setNotifyOnDeployFail] = React.useState(
    settings.notifyOnDeployFail ?? true
  )
  const [notifyOnSecurityAlert, setNotifyOnSecurityAlert] = React.useState(
    settings.notifyOnSecurityAlert ?? true
  )
  const [notifyOnBackupFailure, setNotifyOnBackupFailure] = React.useState(
    settings.notifyOnBackupFailure ?? true
  )

  const [testStatus, setTestStatus] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)

  const handleSendTestAlert = async () => {
    setTestStatus("testing")
    try {
      const res = await testNotifications({
        webhookUrl: discordWebhook.trim(),
        slackWebhookUrl: slackWebhook.trim(),
        email: alertEmail.trim(),
      })
      if (res.ok) {
        setTestStatus("success")
        addAuditLog({
          action: "Notification Test Dispatched",
          category: "config",
          actor: { name: "admin@gettako.dev", type: "user" },
          target: "Outbound Webhooks",
          details:
            res.message ||
            "Test alert dispatched to configured notification channels",
          status: "success",
        })
      } else {
        setTestStatus("error")
      }
    } catch {
      setTestStatus("error")
    } finally {
      setTimeout(() => setTestStatus(null), 3000)
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const valid = validate({
      notificationsEnabled,
      emailAlertsEnabled: emailAlerts,
      telegramEnabled,
      discordWebhook,
      slackWebhook,
      alertEmail,
      smtpHost,
      smtpPort,
      telegramBotToken,
      telegramChatId,
    })
    if (!valid) return

    updateSettings({
      notificationsEnabled,
      webhookUrl: discordWebhook.trim(),
      slackWebhookUrl: slackWebhook.trim(),
      emailAlertsEnabled: emailAlerts,
      alertEmail: alertEmail.trim(),
      smtpHost: smtpHost.trim(),
      smtpPort: Number.parseInt(smtpPort, 10) || 587,
      telegramEnabled,
      telegramBotToken: telegramBotToken.trim(),
      telegramChatId: telegramChatId.trim(),
      notifyOnOutage,
      notifyOnDeployFail,
      notifyOnSecurityAlert,
      notifyOnBackupFailure,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
        <SettingsSectionHeader
          icon={Bell}
          title="Notification Channels & Telemetry Alerts"
          description="Configure Discord webhooks, Slack channels, SMTP email delivery, and Telegram bot alerts for cluster events."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendTestAlert}
              disabled={testStatus === "testing" || !notificationsEnabled}
              className="gap-1.5 text-xs"
            >
              {testStatus === "testing" ? (
                <span>Sending Alert...</span>
              ) : testStatus === "success" ? (
                <>
                  <Check className="size-3 text-emerald-500" />
                  <span>Sent (HTTP 200 OK)</span>
                </>
              ) : (
                <>
                  <Send className="size-3" />
                  <span>Send Test Alert</span>
                </>
              )}
            </Button>
          }
        />

        <form onSubmit={handleSave} noValidate className="space-y-5">
          <FieldGroup className="gap-4">
            {/* Global Dispatch Switch */}
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-3">
              <div>
                <span className="block text-xs font-semibold text-foreground">
                  Global Notification Dispatch
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Toggle all outbound event webhooks, SMTP alerts, and emergency
                  notifications.
                </p>
              </div>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="size-4 cursor-pointer rounded accent-primary"
              />
            </div>

            {/* Channels Grid */}
            <div className="space-y-4 pt-1">
              <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Connected Alert Channels
              </h3>

              {/* Discord Webhook */}
              <Field data-invalid={Boolean(errors.discordWebhook)}>
                <FieldLabel className="flex items-center gap-1.5 text-xs">
                  <MessageSquare className="size-3.5 text-primary" />
                  <span>Discord Webhook URL</span>
                </FieldLabel>
                <Input
                  placeholder="https://discord.com/api/webhooks/..."
                  value={discordWebhook}
                  onChange={(e) => {
                    setDiscordWebhook(e.target.value)
                    clearError("discordWebhook")
                  }}
                  disabled={!notificationsEnabled}
                  aria-invalid={Boolean(errors.discordWebhook)}
                  aria-describedby={
                    errors.discordWebhook ? "discord-webhook-error" : undefined
                  }
                  className="font-mono text-xs"
                />
                <FieldError id="discord-webhook-error" className="text-[11px]">
                  {errors.discordWebhook}
                </FieldError>
              </Field>

              {/* Slack Webhook */}
              <Field data-invalid={Boolean(errors.slackWebhook)}>
                <FieldLabel className="flex items-center gap-1.5 text-xs">
                  <MessageSquare className="size-3.5 text-primary" />
                  <span>Slack Incoming Webhook URL</span>
                </FieldLabel>
                <Input
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhook}
                  onChange={(e) => {
                    setSlackWebhook(e.target.value)
                    clearError("slackWebhook")
                  }}
                  disabled={!notificationsEnabled}
                  aria-invalid={Boolean(errors.slackWebhook)}
                  aria-describedby={
                    errors.slackWebhook ? "slack-webhook-error" : undefined
                  }
                  className="font-mono text-xs"
                />
                <FieldError id="slack-webhook-error" className="text-[11px]">
                  {errors.slackWebhook}
                </FieldError>
              </Field>

              {/* Email / SMTP Channel */}
              <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Mail className="size-3 text-primary" />
                      <span>Email / SMTP Alert Relay</span>
                    </span>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Deliver urgent cluster incidents and automated snapshot
                      logs via standard SMTP.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    disabled={!notificationsEnabled}
                    aria-label="Enable Email alerts"
                    className="size-4 cursor-pointer rounded accent-primary disabled:opacity-50"
                  />
                </div>

                {emailAlerts && (
                  <div className="grid grid-cols-1 gap-4 border-t border-border/50 pt-2 sm:grid-cols-3">
                    <Field data-invalid={Boolean(errors.alertEmail)}>
                      <FieldLabel className="flex items-center gap-1.5 text-xs">
                        <Mail className="size-3.5 text-primary" />
                        <span>Alert Recipient Email</span>
                      </FieldLabel>
                      <Input
                        type="email"
                        value={alertEmail}
                        onChange={(e) => {
                          setAlertEmail(e.target.value)
                          clearError("alertEmail")
                        }}
                        disabled={!notificationsEnabled}
                        aria-invalid={Boolean(errors.alertEmail)}
                        aria-describedby={
                          errors.alertEmail ? "alert-email-error" : undefined
                        }
                        className="font-mono text-xs"
                      />
                      <FieldError
                        id="alert-email-error"
                        className="text-[11px]"
                      >
                        {errors.alertEmail}
                      </FieldError>
                    </Field>

                    <Field data-invalid={Boolean(errors.smtpHost)}>
                      <FieldLabel className="text-xs">SMTP Host</FieldLabel>
                      <Input
                        value={smtpHost}
                        onChange={(e) => {
                          setSmtpHost(e.target.value)
                          clearError("smtpHost")
                        }}
                        disabled={!notificationsEnabled}
                        aria-invalid={Boolean(errors.smtpHost)}
                        aria-describedby={
                          errors.smtpHost ? "smtp-host-error" : undefined
                        }
                        className="font-mono text-xs"
                      />
                      <FieldError id="smtp-host-error" className="text-[11px]">
                        {errors.smtpHost}
                      </FieldError>
                    </Field>

                    <Field data-invalid={Boolean(errors.smtpPort)}>
                      <FieldLabel className="text-xs">SMTP Port</FieldLabel>
                      <Input
                        type="number"
                        value={smtpPort}
                        onChange={(e) => {
                          setSmtpPort(e.target.value)
                          clearError("smtpPort")
                        }}
                        disabled={!notificationsEnabled}
                        aria-invalid={Boolean(errors.smtpPort)}
                        aria-describedby={
                          errors.smtpPort ? "smtp-port-error" : undefined
                        }
                        className="font-mono text-xs"
                      />
                      <FieldError id="smtp-port-error" className="text-[11px]">
                        {errors.smtpPort}
                      </FieldError>
                    </Field>
                  </div>
                )}
              </div>

              {/* Telegram Bot */}
              <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Send className="size-3 text-primary" />
                      <span>Telegram Bot Alert Relay</span>
                    </span>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Send instant operational alerts directly to a private
                      Telegram channel or chat.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={telegramEnabled}
                    onChange={(e) => setTelegramEnabled(e.target.checked)}
                    disabled={!notificationsEnabled}
                    className="size-4 cursor-pointer rounded accent-primary disabled:opacity-50"
                  />
                </div>

                {telegramEnabled && (
                  <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                    <Field data-invalid={Boolean(errors.telegramBotToken)}>
                      <FieldLabel className="text-xs">Bot API Token</FieldLabel>
                      <Input
                        type="password"
                        placeholder="1234567890:ABCdef..."
                        value={telegramBotToken}
                        onChange={(e) => {
                          setTelegramBotToken(e.target.value)
                          clearError("telegramBotToken")
                        }}
                        aria-invalid={Boolean(errors.telegramBotToken)}
                        aria-describedby={
                          errors.telegramBotToken
                            ? "telegram-bot-token-error"
                            : undefined
                        }
                        className="font-mono text-xs"
                      />
                      <FieldError
                        id="telegram-bot-token-error"
                        className="text-[11px]"
                      >
                        {errors.telegramBotToken}
                      </FieldError>
                    </Field>
                    <Field data-invalid={Boolean(errors.telegramChatId)}>
                      <FieldLabel className="text-xs">
                        Chat / Channel ID
                      </FieldLabel>
                      <Input
                        placeholder="-1001234567890"
                        value={telegramChatId}
                        onChange={(e) => {
                          setTelegramChatId(e.target.value)
                          clearError("telegramChatId")
                        }}
                        aria-invalid={Boolean(errors.telegramChatId)}
                        aria-describedby={
                          errors.telegramChatId
                            ? "telegram-chat-id-error"
                            : undefined
                        }
                        className="font-mono text-xs"
                      />
                      <FieldError
                        id="telegram-chat-id-error"
                        className="text-[11px]"
                      >
                        {errors.telegramChatId}
                      </FieldError>
                    </Field>
                  </div>
                )}
              </div>
            </div>

            {/* Event Trigger Subscriptions */}
            <div className="space-y-3 border-t border-border pt-2">
              <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Event Subscriptions
              </h3>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card p-2.5 text-xs text-foreground transition-colors hover:bg-muted/30">
                  <input
                    type="checkbox"
                    checked={notifyOnOutage}
                    onChange={(e) => setNotifyOnOutage(e.target.checked)}
                    disabled={!notificationsEnabled}
                    className="size-3.5 cursor-pointer rounded accent-primary"
                  />
                  <span>Edge Node Outage / Heartbeat Failure</span>
                </label>

                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card p-2.5 text-xs text-foreground transition-colors hover:bg-muted/30">
                  <input
                    type="checkbox"
                    checked={notifyOnDeployFail}
                    onChange={(e) => setNotifyOnDeployFail(e.target.checked)}
                    disabled={!notificationsEnabled}
                    className="size-3.5 cursor-pointer rounded accent-primary"
                  />
                  <span>Container Deployment Build Error</span>
                </label>

                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card p-2.5 text-xs text-foreground transition-colors hover:bg-muted/30">
                  <input
                    type="checkbox"
                    checked={notifyOnSecurityAlert}
                    onChange={(e) => setNotifyOnSecurityAlert(e.target.checked)}
                    disabled={!notificationsEnabled}
                    className="size-3.5 cursor-pointer rounded accent-primary"
                  />
                  <span>Security Allowlist & Unauthorized Join</span>
                </label>

                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card p-2.5 text-xs text-foreground transition-colors hover:bg-muted/30">
                  <input
                    type="checkbox"
                    checked={notifyOnBackupFailure}
                    onChange={(e) => setNotifyOnBackupFailure(e.target.checked)}
                    disabled={!notificationsEnabled}
                    className="size-3.5 cursor-pointer rounded accent-primary"
                  />
                  <span>Automated Snapshot / Backup Failure</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end border-t border-border pt-3">
              <Button type="submit" size="sm" className="gap-1.5 text-xs">
                {saved ? (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    <span>Notification Settings Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3" />
                    <span>Save Notification Settings</span>
                  </>
                )}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </div>
    </div>
  )
}
