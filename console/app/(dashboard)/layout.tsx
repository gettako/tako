import * as React from "react"
import { AppHeader } from "@/components/app-header"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh min-w-0 flex-col overflow-x-hidden bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-screen-2xl min-w-0 flex-1 overflow-x-auto p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
