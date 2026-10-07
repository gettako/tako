import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchServer, APIError } from '@/lib/api-client';

const SESSION_COOKIE = 'tako_session';
const SESSION_USER_COOKIE = 'tako_user';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    try {
      // Authenticate with Tako Go Server
      const result = await fetchServer<{
        token: string;
        user: { id: string; name: string; email: string; role: string; avatarUrl?: string };
      }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE, result.token || `tako_sess_${Date.now()}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      cookieStore.set(SESSION_USER_COOKIE, JSON.stringify(result.user), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return NextResponse.json({ user: result.user });
    } catch (apiErr: unknown) {
      if (apiErr instanceof APIError) {
        if (apiErr.status === 401) {
          return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }
        return NextResponse.json({ error: apiErr.message }, { status: apiErr.status });
      }

      // Dev fallback if Go server is not running
      if (process.env.NODE_ENV !== 'production' && email === 'admin@gettako.dev' && password === 'admin123456') {
        const fallbackUser = {
          id: 'usr_admin',
          name: 'Administrator',
          email,
          role: 'admin',
        };
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE, `tako_sess_${Date.now()}`, {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });
        cookieStore.set(SESSION_USER_COOKIE, JSON.stringify(fallbackUser), {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });
        return NextResponse.json({ user: fallbackUser });
      }

      return NextResponse.json({ error: 'Could not connect to authentication server' }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const userJson = cookieStore.get(SESSION_USER_COOKIE)?.value;
  let user = {
    id: 'usr_admin',
    name: 'Administrator',
    email: 'admin@gettako.dev',
    role: 'admin',
  };

  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch {
      // fallback to default
    }
  }

  return NextResponse.json({
    authenticated: true,
    user,
  });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(SESSION_USER_COOKIE);
  return NextResponse.json({ success: true });
}
