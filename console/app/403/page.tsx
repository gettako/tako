import type { Metadata } from "next"

import { ErrorView } from "@/components/error/error-view"

export const metadata: Metadata = {
  title: "403 - Access Forbidden",
  description:
    "Security policy disallows access to this control plane subsystem.",
}

export default function ForbiddenRoutePage() {
  return (
    <ErrorView
      statusCode="403"
      title="Access Forbidden"
      description="Your current role or session token lacks authorization to access this edge cluster resource or control plane subsystem. Contact your cluster administrator if you require escalated permissions."
    />
  )
}
