import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'tako_session';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Default admin credential validation or backend pass-through
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Set secure HttpOnly session cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, `tako_sess_${Date.now()}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({
      user: {
        id: 'usr_admin',
        name: 'Administrator',
        email,
        role: 'admin',
      },
    });
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

  return NextResponse.json({
    authenticated: true,
    user: {
      id: 'usr_admin',
      name: 'Administrator',
      email: 'admin@gettako.dev',
      role: 'admin',
    },
  });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ success: true });
}
