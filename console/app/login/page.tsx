import type { Metadata } from "next"

import { LoginView } from "@/components/login-view"

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Tako edge platform.",
}

export default function LoginPage() {
  return <LoginView />
}
