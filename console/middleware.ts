import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static files, api routes, and internal next paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/logo') ||
    /\.(.*)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get('tako_session');
  const isLoginPage = pathname === '/login' || pathname.startsWith('/login/');

  // If already logged in, redirect away from /login to dashboard
  if (session?.value && isLoginPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // If not logged in, redirect to /login
  if (!session?.value && !isLoginPage) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
