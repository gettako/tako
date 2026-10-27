import { ErrorView } from "@/components/error/error-view"

export default function ForbiddenPage() {
  return (
    <>
      <title>403 - Access Forbidden | Tako</title>
      <ErrorView
        statusCode="403"
        title="Access Forbidden"
        description="Your current role or session token lacks authorization to access this edge cluster resource or control plane subsystem. Contact your cluster administrator if you require escalated permissions."
      />
    </>
  )
}
