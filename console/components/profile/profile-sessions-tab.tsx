"use client"

import * as React from "react"
import {
  Globe,
  Laptop,
  LogOut,
  Radio,
  ShieldAlert,
  Smartphone,
  Terminal,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { usePlatformData } from "@/context/platform-data-context"
import type { UserSession } from "@/types/platform"

export function ProfileSessionsTab() {
  const { sessions, revokeSession, revokeAllOtherSessions } = usePlatformData()

  const [revokeAllModalOpen, setRevokeAllModalOpen] = React.useState(false)
  const [revokeTarget, setRevokeTarget] = React.useState<UserSession | null>(
    null
  )

  const otherSessions = sessions.filter((s) => !s.isCurrent)
  const currentSession = sessions.find((s) => s.isCurrent) || sessions[0]

  const getDeviceIcon = (device: string, browser: string) => {
    if (
      device.toLowerCase().includes("iphone") ||
      device.toLowerCase().includes("mobile")
    ) {
      return <Smartphone className="size-4" />
    }
    if (
      browser.toLowerCase().includes("cli") ||
      device.toLowerCase().includes("terminal")
    ) {
      return <Terminal className="size-4" />
    }
    return <Laptop className="size-4" />
  }

  const handleRevokeConfirm = () => {
    if (revokeTarget) {
      revokeSession(revokeTarget.id)
      setRevokeTarget(null)
    }
  }

  const handleRevokeAllConfirm = () => {
    revokeAllOtherSessions()
    setRevokeAllModalOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Laptop className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Active Operator Sessions & Connected Devices
              </h2>
              <span className="font-mono text-xs text-muted-foreground">
                {sessions.length} Active
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Review and terminate authenticated operator sessions across
              browsers, mobile devices, and CLI terminals.
            </p>
          </div>

          {otherSessions.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRevokeAllModalOpen(true)}
              className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-3" />
              <span>Revoke All Other Sessions</span>
            </Button>
          )}
        </div>

        {/* Current Active Session Card */}
        {currentSession && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-md border border-primary/30 bg-primary/10 p-2 text-primary">
                  {getDeviceIcon(currentSession.device, currentSession.browser)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {currentSession.device}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-500">
                      <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                      <span>Current Session</span>
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {currentSession.browser}
                  </p>
                </div>
              </div>

              <div className="text-right font-mono text-[11px] text-muted-foreground">
                <p className="flex items-center justify-end gap-1 font-medium text-foreground">
                  <Radio className="size-3 text-emerald-500" />
                  <span>{currentSession.lastActive}</span>
                </p>
                <p>
                  {currentSession.ipAddress} • {currentSession.location}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Other Active Sessions List */}
        <div className="space-y-2 pt-2">
          <span className="block text-xs font-semibold text-muted-foreground">
            Other Authenticated Devices ({otherSessions.length})
          </span>

          {otherSessions.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No other active operator sessions found. You are only signed in on
              this workstation.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {otherSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3.5 transition-colors hover:bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-md border border-border bg-muted/40 p-2 text-muted-foreground">
                      {getDeviceIcon(session.device, session.browser)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">
                          {session.device}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {session.browser}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Globe className="size-3" />
                          <span>{session.location}</span>
                        </span>
                        <span>IP: {session.ipAddress}</span>
                        <span>Last active: {session.lastActive}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setRevokeTarget(session)}
                    className="gap-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="size-3" />
                    <span>Revoke</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revoke Individual Session Dialog */}
      <Dialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <LogOut className="size-4 shrink-0" />
              <span>Revoke Device Session</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Terminating this session will immediately log out the user from
              that device.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground">
            Are you sure you want to terminate the session on{" "}
            <strong className="text-foreground">{revokeTarget?.device}</strong>{" "}
            ({revokeTarget?.browser})?
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRevokeTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRevokeConfirm}
            >
              Revoke Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke All Other Sessions Dialog */}
      <Dialog open={revokeAllModalOpen} onOpenChange={setRevokeAllModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <span>Revoke All Other Sessions?</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will immediately invalidate login tokens on all other
              browsers, mobile devices, and CLI instances.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground">
            You will remain authenticated on this workstation only. All{" "}
            {otherSessions.length} other devices will be disconnected
            immediately.
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRevokeAllModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRevokeAllConfirm}
            >
              Revoke All Other Sessions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
