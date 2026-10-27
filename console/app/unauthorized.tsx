import { ErrorView } from "@/components/error/error-view"

export default function UnauthorizedPage() {
  return (
    <>
      <title>401 - Authentication Required | Tako</title>
      <ErrorView
        statusCode="401"
        title="Authentication Required"
        description="No valid cryptographic session token was detected. Please authenticate to establish a secure handshake with the Tako control plane."
      />
    </>
  )
}
