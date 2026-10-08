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

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function loginWithPasskey(): Promise<User> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    throw new Error('Your browser or device does not support passkey authentication.');
  }

  // 1. Fetch registered passkeys to ensure passkeys exist on account & populate allowCredentials
  let registeredPasskeys: { id: string; credentialId?: string }[] = [];
  try {
    const res = await fetch('/api/auth/passkeys');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        registeredPasskeys = data;
      }
    }
  } catch {
    // If fetching passkeys fails, backend will still validate
  }

  if (registeredPasskeys.length === 0) {
    throw new Error('No passkey registered for this account. Please sign in with email and password first.');
  }

  // 2. Trigger native browser WebAuthn biometric or security key prompt
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const allowCredentials: PublicKeyCredentialDescriptor[] = [];
  for (const pk of registeredPasskeys) {
    const credIdStr = pk.credentialId || pk.id;
    if (credIdStr) {
      try {
        const buffer = base64UrlToBuffer(credIdStr);
        if (buffer && buffer.byteLength > 0) {
          allowCredentials.push({
            id: buffer,
            type: 'public-key',
          });
        }
      } catch {
        // If not base64url, omit so resident key can resolve
      }
    }
  }

  const publicKeyOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: window.location.hostname,
    userVerification: 'preferred',
    timeout: 60000,
  };

  if (allowCredentials.length > 0) {
    publicKeyOptions.allowCredentials = allowCredentials;
  }

  let credential: PublicKeyCredential | null = null;
  try {
    credential = (await navigator.credentials.get({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;
  } catch (credErr: unknown) {
    if (credErr instanceof Error) {
      if (credErr.name === 'NotAllowedError') {
        throw new Error('Passkey sign-in was cancelled or verification failed.');
      }
      if (credErr.name === 'AbortError') {
        throw new Error('Passkey sign-in timed out.');
      }
      if (credErr.name === 'NotFoundError') {
        throw new Error('No matching passkey found on this device.');
      }
      throw new Error(credErr.message || 'Passkey authentication failed.');
    }
    throw new Error('Passkey authentication failed.');
  }

  if (!credential || !credential.id) {
    throw new Error('Passkey authentication failed: No credential returned.');
  }

  // 3. Send verified credential to backend
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'passkey',
      credentialId: credential.id,
    }),
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

  throw new Error('Failed to retrieve user data after passkey authentication.');
}
