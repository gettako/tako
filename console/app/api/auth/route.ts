import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchServer, APIError } from '@/lib/api-client';
import { getUserAvatarUrl } from '@/lib/avatar';

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
        user: { id: string; name: string; email: string; role: string; avatarUrl?: string; twoFactorEnabled?: boolean; createdAt?: string };
      }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const userWithAvatar = {
        ...result.user,
        avatarUrl: getUserAvatarUrl(result.user.email, result.user.avatarUrl),
      };

      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE, result.token || `tako_sess_${Date.now()}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      cookieStore.set(SESSION_USER_COOKIE, JSON.stringify(userWithAvatar), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return NextResponse.json({ user: userWithAvatar });
    } catch (apiErr: unknown) {
      if (apiErr instanceof APIError) {
        if (apiErr.status === 401) {
          return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }
        return NextResponse.json({ error: apiErr.message }, { status: apiErr.status });
      }

      // Dev fallback if Go server is temporarily unreachable
      if (process.env.NODE_ENV !== 'production' && email === 'admin@gettako.dev' && password === 'admin123456') {
        const fallbackUser = {
          id: 'usr_admin',
          name: 'Administrator',
          email,
          role: 'admin',
          avatarUrl: getUserAvatarUrl(email),
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
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

  // First attempt to get the latest live user from Go server
  try {
    const live = await fetchServer<{
      authenticated: boolean;
      user: { id: string; name: string; email: string; role: string; avatarUrl?: string; twoFactorEnabled?: boolean; createdAt?: string };
    }>('/api/v1/auth/me');

    if (live && live.user) {
      const user = {
        ...live.user,
        avatarUrl: getUserAvatarUrl(live.user.email, live.user.avatarUrl),
      };

      // Update cookie
      cookieStore.set(SESSION_USER_COOKIE, JSON.stringify(user), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return NextResponse.json({
        authenticated: true,
        user,
      });
    }
  } catch {
    // If backend is unreachable, fallback to cookie
  }

  const userJson = cookieStore.get(SESSION_USER_COOKIE)?.value;
  let user = {
    id: 'usr_admin',
    name: 'Administrator',
    email: 'admin@gettako.dev',
    role: 'admin',
    avatarUrl: getUserAvatarUrl('admin@gettako.dev'),
    twoFactorEnabled: false,
    createdAt: new Date().toISOString(),
  };

  if (userJson) {
    try {
      const parsed = JSON.parse(userJson);
      user = {
        ...parsed,
        avatarUrl: getUserAvatarUrl(parsed.email, parsed.avatarUrl),
      };
    } catch {
      // fallback to default
    }
  }

  return NextResponse.json({
    authenticated: true,
    user,
  });
}

export async function PUT(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    let updatedUser: {
      id: string;
      name: string;
      email: string;
      role: string;
      avatarUrl?: string;
      twoFactorEnabled?: boolean;
      createdAt?: string;
    };

    try {
      const res = await fetchServer<{
        id: string;
        name: string;
        email: string;
        role: string;
        avatarUrl?: string;
        twoFactorEnabled?: boolean;
        createdAt?: string;
      }>('/api/v1/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      updatedUser = res;
    } catch {
      // Fallback
      const userJson = cookieStore.get(SESSION_USER_COOKIE)?.value;
      const current = userJson ? JSON.parse(userJson) : {};
      updatedUser = {
        ...current,
        name: body.name || current.name,
        email: body.email || current.email,
        avatarUrl: body.avatarUrl || current.avatarUrl,
      };
    }

    const finalUser = {
      ...updatedUser,
      avatarUrl: getUserAvatarUrl(updatedUser.email, updatedUser.avatarUrl),
    };

    cookieStore.set(SESSION_USER_COOKIE, JSON.stringify(finalUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({ user: finalUser });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(SESSION_USER_COOKIE);

  try {
    await fetchServer('/api/v1/auth/logout', { method: 'POST' });
  } catch {
    // Ignore
  }

  return NextResponse.json({ success: true });
}
