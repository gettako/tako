import type { Metadata } from "next"

import { DashboardView } from "@/components/dashboard/dashboard-view"

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Real-time gRPC node coordination and automated container deployment platform.",
}

export default function DashboardPage() {
  return <DashboardView />
}
