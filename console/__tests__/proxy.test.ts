import { describe, it, expect } from "bun:test"
import { NextRequest } from "next/server"
import { proxy } from "../proxy"

describe("Next.js Proxy / Auth Gatekeeper", () => {
  const createRequest = (url: string, cookieValue?: string) => {
    const req = new NextRequest(new URL(url, "http://localhost:3000"))
    if (cookieValue) {
      req.cookies.set("tako_session", cookieValue)
    }
    return req
  }

  it("redirects unauthenticated user accessing / to /login without from param", () => {
    const req = createRequest("/")
    const res = proxy(req)

    expect(res.status).toBe(307)
    const location = res.headers.get("location")
    expect(location).toBe("http://localhost:3000/login")
  })

  it("redirects unauthenticated user accessing /projects to /login?from=/projects", () => {
    const req = createRequest("/projects")
    const res = proxy(req)

    expect(res.status).toBe(307)
    const location = res.headers.get("location")
    expect(location).toContain("/login?from=%2Fprojects")
  })

  it("redirects unauthenticated user accessing nested route /settings/security to /login?from=/settings/security", () => {
    const req = createRequest("/settings/security")
    const res = proxy(req)

    expect(res.status).toBe(307)
    const location = res.headers.get("location")
    expect(location).toContain("/login?from=%2Fsettings%2Fsecurity")
  })

  it("allows unauthenticated user accessing /login", () => {
    const req = createRequest("/login")
    const res = proxy(req)

    // Should not redirect
    expect(res.headers.get("location")).toBeNull()
  })

  it("allows unauthenticated user accessing /api/auth/login", () => {
    const req = createRequest("/api/auth/login")
    const res = proxy(req)

    expect(res.headers.get("location")).toBeNull()
  })

  it("allows authenticated user accessing protected route /", () => {
    const req = createRequest("/", "sess_test123")
    const res = proxy(req)

    expect(res.headers.get("location")).toBeNull()
  })

  it("allows authenticated user accessing /projects", () => {
    const req = createRequest("/projects", "sess_test123")
    const res = proxy(req)

    expect(res.headers.get("location")).toBeNull()
  })

  it("redirects authenticated user accessing /login to /", () => {
    const req = createRequest("/login", "sess_test123")
    const res = proxy(req)

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3000/")
  })

  it("allows unauthenticated user accessing /register", () => {
    const req = createRequest("/register?token=test_token_123")
    const res = proxy(req)

    expect(res.headers.get("location")).toBeNull()
  })

  it("redirects authenticated user accessing /register to /", () => {
    const req = createRequest("/register?token=test_token_123", "sess_test123")
    const res = proxy(req)

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3000/")
  })

  it("normalizes /dashboard to / for authenticated user", () => {
    const req = createRequest("/dashboard", "sess_test123")
    const res = proxy(req)

    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3000/")
  })
})
