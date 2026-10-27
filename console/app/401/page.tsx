import type { Metadata } from "next"

import { ErrorView } from "@/components/error/error-view"

export const metadata: Metadata = {
  title: "401 - Authentication Required",
  description:
    "Authentication is required to access this edge cluster control plane.",
}

export default function UnauthorizedRoutePage() {
  return (
    <ErrorView
      statusCode="401"
      title="Authentication Required"
      description="No valid cryptographic session token was detected. Please authenticate to establish a secure handshake with the Tako control plane."
    />
  )
}
