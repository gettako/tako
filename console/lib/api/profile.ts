import { simulateDelay } from './delay';
import { mockCurrentUser, mockSessions, mockPasskeys } from '@/lib/mock/data';
import { User, Session, Passkey } from '@/lib/types';
import { getUserAvatarUrl } from '@/lib/avatar';

let currentUser: User = { ...mockCurrentUser };
let sessions: Session[] = [...mockSessions];
let passkeys: Passkey[] = [...mockPasskeys];

/* --- Current User & Profile --- */
export async function getCurrentUser(): Promise<User> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/auth');
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const u = data.user;
          return {
            id: u.id || 'usr_admin',
            name: u.name || 'Administrator',
            email: u.email || 'admin@gettako.dev',
            role: u.role || 'admin',
            avatarUrl: getUserAvatarUrl(u.email, u.avatarUrl),
            twoFactorEnabled: !!u.twoFactorEnabled,
            createdAt: u.createdAt || new Date().toISOString(),
          };
        }
      }
    } catch {
      // Fallback
    }
  }
  return {
    ...currentUser,
    avatarUrl: getUserAvatarUrl(currentUser.email, currentUser.avatarUrl),
  };
}

export async function updateCurrentUser(input: Partial<User>): Promise<User> {
  if (typeof window !== 'undefined') {
    const res = await fetch('/api/auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update profile');
    }
    const data = await res.json();
    const u = data.user;
    currentUser = {
      ...u,
      avatarUrl: getUserAvatarUrl(u.email, u.avatarUrl),
    };
    return { ...currentUser };
  }
  currentUser = { ...currentUser, ...input };
  return { ...currentUser };
}

/* --- Password Change --- */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  if (typeof window !== 'undefined') {
    const res = await fetch('/api/auth/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update password');
    }
    return;
  }
  await simulateDelay();
}

/* --- Two-Factor Authentication (TOTP) --- */
export async function get2FASetup(): Promise<{ secret: string; otpauthUrl: string; recoveryCodes: string[] }> {
  if (typeof window !== 'undefined') {
    const res = await fetch('/api/auth/2fa');
    if (res.ok) {
      return res.json();
    }
  }
  throw new Error('Failed to load 2FA setup configuration');
}

export async function verifyAndEnable2FA(code: string, secret: string, recoveryCodes: string[]): Promise<void> {
  if (typeof window !== 'undefined') {
    const res = await fetch('/api/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', code, secret, recoveryCodes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Invalid 6-digit authentication code');
    }
    currentUser.twoFactorEnabled = true;
    return;
  }
  currentUser.twoFactorEnabled = true;
}

export async function disable2FA(): Promise<void> {
  if (typeof window !== 'undefined') {
    const res = await fetch('/api/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disable' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to disable 2FA');
    }
    currentUser.twoFactorEnabled = false;
    return;
  }
  currentUser.twoFactorEnabled = false;
}

/* --- Sessions --- */
export async function getSessions(): Promise<Session[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/auth/sessions');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      // fallback
    }
  }
  return [...sessions];
}

export async function revokeSession(sessionId: string): Promise<void> {
  if (typeof window !== 'undefined') {
    const res = await fetch(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to revoke session');
    }
    return;
  }
  sessions = sessions.filter((s) => s.id !== sessionId);
}

export async function revokeAllOtherSessions(currentSessionId: string): Promise<void> {
  if (typeof window !== 'undefined') {
    const res = await fetch('/api/auth/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke-others' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to revoke sessions');
    }
    return;
  }
  sessions = sessions.filter((s) => s.id === currentSessionId);
}

/* --- Passkeys --- */
export async function getPasskeys(): Promise<Passkey[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/auth/passkeys');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      // fallback
    }
  }
  return [...passkeys];
}

export async function addPasskey(name: string): Promise<Passkey> {
  if (typeof window !== 'undefined') {
    const res = await fetch('/api/auth/passkeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to register passkey');
    }
    return res.json();
  }
  const newKey: Passkey = {
    id: `pk-${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
    lastUsedAt: 'Just now',
  };
  passkeys.push(newKey);
  return { ...newKey };
}

export async function deletePasskey(id: string): Promise<void> {
  if (typeof window !== 'undefined') {
    const res = await fetch(`/api/auth/passkeys/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to remove passkey');
    }
    return;
  }
  passkeys = passkeys.filter((p) => p.id !== id);
}

/**
 * Clean WebAuthn browser credential creation abstraction.
 * Keeps platform WebAuthn API orchestration out of React UI components.
 */
export async function registerPasskeyWithWebAuthn(name: string): Promise<Passkey> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Passkey name is required');

  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'Tako Cloud Console',
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: trimmed,
            displayName: trimmed,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },  // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            userVerification: 'preferred',
            residentKey: 'preferred',
          },
          timeout: 60000,
        },
      });
    } catch (credErr: unknown) {
      if (credErr instanceof Error && credErr.name === 'NotAllowedError') {
        throw new Error('Passkey creation cancelled or timed out');
      }
      // If hardware key cancelled with other code, still propagate or continue
    }
  }

  return addPasskey(trimmed);
}
