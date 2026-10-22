import type { Metadata } from "next"

import { SettingsView } from "@/components/settings/settings-view"

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Configure cluster-wide operators, storage buckets, Git continuous integration, TLS domains, and telemetry policies.",
}

export default function SettingsPage() {
  return <SettingsView />
}
