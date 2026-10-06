import { simulateDelay } from './delay';
import { mockCurrentUser } from '@/lib/mock/data';
import { User } from '@/lib/types';

export async function login(email: string, password: string): Promise<User> {
  await simulateDelay();

  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  // Accept owner or any valid credentials for prototype
  if (typeof document !== 'undefined') {
    document.cookie = 'tako_session=mock-token; path=/; max-age=86400; SameSite=Lax';
  }

  return {
    ...mockCurrentUser,
    email: email.trim(),
  };
}

export async function logout(): Promise<void> {
  await simulateDelay();
  if (typeof document !== 'undefined') {
    document.cookie = 'tako_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  }
}
