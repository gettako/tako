import { describe, it, expect, mock } from "bun:test"
import * as React from "react"
import { renderToString } from "react-dom/server"
import LoginPage from "../page"

// Mock next/navigation
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

describe("LoginPage", () => {
  it("renders centered login card with email and password inputs and passkey button", () => {
    const html = renderToString(<LoginPage />)

    expect(html).toContain("Sign in")
    expect(html).toContain("Email Address")
    expect(html).toContain("Password")
    expect(html).toContain('type="email"')
    expect(html).toContain('type="password"')
    expect(html).toContain("Sign in with Password")
    expect(html).toContain("Sign in with Passkey")
    expect(html).toContain("max-w-md")
    expect(html).toContain("border border-border")
  })

  it("does not contain em dashes", () => {
    const html = renderToString(<LoginPage />)
    expect(html).not.toContain("—")
  })
})
