import { Metadata } from "next"

import { AuditLogsView } from "@/components/audit/audit-logs-view"

export const metadata: Metadata = {
  title: "Audit Logs",
  description:
    "Immutable log of deployment actions, edge agent connections, and security mutations.",
}

export default function AuditLogsPage() {
  return <AuditLogsView />
}
