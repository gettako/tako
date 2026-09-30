import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const SESSION_COOKIE_NAME = "tako_session"

const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/passkey/login/begin",
  "/api/auth/passkey/login/finish",
  "/api/invites/validate",
  "/api/invites/accept",
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value

  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  // Unauthenticated user attempting to access protected route
  if (!session) {
    if (!isPublic) {
      const loginUrl = new URL("/login", request.url)
      if (pathname !== "/" && pathname !== "/dashboard") {
        loginUrl.searchParams.set("from", pathname)
      }
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Authenticated user attempting to access /login or /register
  if (pathname === "/login" || pathname === "/register") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // Normalize /dashboard to /
  if (pathname === "/dashboard") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static asset extensions (.svg, .png, .jpg, .css, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ico|css|js)$).*)",
  ],
}
