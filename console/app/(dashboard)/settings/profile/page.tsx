"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

export default function SettingsProfileRedirect() {
  const router = useRouter()

  React.useEffect(() => {
    router.replace("/profile")
  }, [router])

  return null
}
