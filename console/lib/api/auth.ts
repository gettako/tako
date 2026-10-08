import { simulateDelay } from './delay';
import { User } from '@/lib/types';
import { getUserAvatarUrl } from '@/lib/avatar';

export async function login(email: string, password: string): Promise<User> {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Invalid credentials');
      }

      // Also set client-readable cookie as fallback
      document.cookie = 'tako_session=active_session; path=/; max-age=604800; SameSite=Lax';

      const data = await res.json().catch(() => ({}));
      if (data.user) {
        return {
          id: data.user.id || 'usr_admin',
          name: data.user.name || 'Administrator',
          email: data.user.email || email.trim(),
          role: data.user.role || 'admin',
          avatarUrl: data.user.avatarUrl || getUserAvatarUrl(email.trim()),
          twoFactorEnabled: !!data.user.twoFactorEnabled,
          createdAt: data.user.createdAt || new Date().toISOString(),
        };
      }
      return {
        id: 'usr_admin',
        name: 'Administrator',
        email: email.trim(),
        role: 'admin',
        avatarUrl: getUserAvatarUrl(email.trim()),
        twoFactorEnabled: false,
        createdAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== 'Failed to fetch') {
        throw err;
      }
    }
  }

  await simulateDelay();
  if (typeof document !== 'undefined') {
    document.cookie = 'tako_session=active_session; path=/; max-age=604800; SameSite=Lax';
  }

  return {
    id: 'usr_admin',
    name: 'Administrator',
    email: email.trim(),
    role: 'admin',
    avatarUrl: getUserAvatarUrl(email.trim()),
    twoFactorEnabled: false,
    createdAt: new Date().toISOString(),
  };
}

export async function logout(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch {
      // Ignore
    }
    document.cookie = 'tako_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  }

  await simulateDelay();
}

export async function loginWithPasskey(): Promise<User> {
  // Trigger native browser WebAuthn biometric or security key prompt
  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: 'preferred',
          timeout: 60000,
        },
      });
    } catch (credErr: unknown) {
      if (credErr instanceof Error && (credErr.name === 'NotAllowedError' || credErr.name === 'AbortError')) {
        throw new Error('Passkey sign-in was cancelled or timed out.');
      }
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'passkey' }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to authenticate with passkey');
      }

      document.cookie = 'tako_session=active_session; path=/; max-age=604800; SameSite=Lax';

      const data = await res.json().catch(() => ({}));
      if (data.user) {
        return {
          id: data.user.id || 'usr_admin',
          name: data.user.name || 'Administrator',
          email: data.user.email || 'admin@gettako.dev',
          role: data.user.role || 'admin',
          avatarUrl: data.user.avatarUrl || getUserAvatarUrl(data.user.email || 'admin@gettako.dev'),
          twoFactorEnabled: !!data.user.twoFactorEnabled,
          createdAt: data.user.createdAt || new Date().toISOString(),
        };
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== 'Failed to fetch') {
        throw err;
      }
    }
  }

  await simulateDelay();
  if (typeof document !== 'undefined') {
    document.cookie = 'tako_session=active_session; path=/; max-age=604800; SameSite=Lax';
  }

  return {
    id: 'usr_admin',
    name: 'Administrator',
    email: 'admin@gettako.dev',
    role: 'admin',
    avatarUrl: getUserAvatarUrl('admin@gettako.dev'),
    twoFactorEnabled: false,
    createdAt: new Date().toISOString(),
  };
}
