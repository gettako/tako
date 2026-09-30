import "@fontsource/plus-jakarta-sans/500.css"
import "@fontsource/plus-jakarta-sans/600.css"
import "@fontsource/plus-jakarta-sans/700.css"
import "@fontsource/iosevka/400.css"
import "@fontsource/iosevka/500.css"

import "./globals.css"
import { ThemeProvider } from "@/app/providers"
import { KeyboardNavigation } from "@/components/keyboard-navigation"
import { cn } from "@/lib/utils"
import { Inter, Plus_Jakarta_Sans } from "next/font/google"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
})

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    default: "Tako - Dashboard",
    template: "Tako - %s",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/tako.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "font-sans antialiased",
        inter.variable,
        jakartaSans.variable
      )}
    >
      <body className="min-h-svh overflow-x-hidden bg-background text-foreground antialiased">
        <ThemeProvider>
          {children}
          <KeyboardNavigation />
        </ThemeProvider>
      </body>
    </html>
  )
}
