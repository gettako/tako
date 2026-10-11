import { NextRequest, NextResponse } from 'next/server';
import { fetchServer } from '@/lib/api-client';
import { getSettingFallback } from '@/app/api/settings/store';
import { UserInvite } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Invite token is required' }, { status: 400 });
    }

    let invites: UserInvite[] = [];
    try {
      const data = await fetchServer<{ value: UserInvite[] } | UserInvite[]>('/api/v1/settings/user_invites');
      invites = Array.isArray(data) ? data : data?.value || [];
    } catch {
      // Backend offline or unreachable
    }

    if (invites.length === 0) {
      const fallback = getSettingFallback('user_invites');
      if (Array.isArray(fallback)) {
        invites = fallback as UserInvite[];
      }
    }

    const invite = invites.find(
      (i) => (i.inviteCode && i.inviteCode === token) || i.token === token
    );
    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found or has already been accepted.' }, { status: 404 });
    }

    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This invitation has expired. Request a new invite from your administrator.' }, { status: 410 });
    }

    return NextResponse.json({
      valid: true,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to verify invitation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
