import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchServer, APIError } from '@/lib/api-client';
import { getUserAvatarUrl } from '@/lib/avatar';
import { UserInvite } from '@/lib/types';

const SESSION_COOKIE = 'tako_session';
const SESSION_USER_COOKIE = 'tako_user';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = (body.token || '').trim();
    const name = (body.name || '').trim();
    const password = (body.password || '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Invite token is required' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // 1. Verify invitation from settings
    let invites: UserInvite[] = [];
    try {
      const data = await fetchServer<{ value: UserInvite[] } | UserInvite[]>('/api/v1/settings/user_invites');
      invites = Array.isArray(data) ? data : data?.value || [];
    } catch {
      invites = [];
    }

    const invite = invites.find((i) => i.token === token);
    if (!invite) {
      return NextResponse.json({ error: 'Invalid or already accepted invitation.' }, { status: 404 });
    }

    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
    }

    // 2. Call Go backend to set credentials and register session
    const result = await fetchServer<{
      token: string;
      user: { id: string; name: string; email: string; role: string; avatarUrl?: string; twoFactorEnabled?: boolean; createdAt?: string };
    }>('/api/v1/auth/invite/accept', {
      method: 'POST',
      body: JSON.stringify({
        email: invite.email,
        name,
        password,
        role: invite.role,
      }),
    });

    // 3. Remove accepted invite from settings
    const remainingInvites = invites.filter((i) => i.token !== token);
    await fetchServer('/api/v1/settings/user_invites', {
      method: 'PUT',
      body: JSON.stringify({ value: remainingInvites }),
    }).catch(() => {});

    // 4. Set session cookies
    const userWithAvatar = {
      ...result.user,
      avatarUrl: getUserAvatarUrl(result.user.email, result.user.avatarUrl),
    };

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, result.token || `tako_session_${Date.now()}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    cookieStore.set(SESSION_USER_COOKIE, JSON.stringify(userWithAvatar), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({ success: true, user: userWithAvatar });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Failed to accept invitation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
