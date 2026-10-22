import type { Metadata } from "next"

import { ErrorView } from "@/components/error/error-view"

export const metadata: Metadata = {
  title: "404 - Route Not Found",
  description:
    "The requested edge route or resource was not found on this Tako cluster.",
}

export default function NotFoundPage() {
  return (
    <ErrorView
      statusCode="404"
      title="Page or Resource Not Found"
      description="The requested path does not match any registered edge endpoints, container services, or telemetry streams. It may have been deleted, moved, or entered incorrectly."
    />
  )
}
