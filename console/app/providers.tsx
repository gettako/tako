"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

import { Toaster } from "@/components/ui/toast"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
      <Toaster />
    </NextThemesProvider>
  )
}

export { ThemeProvider as Providers }
