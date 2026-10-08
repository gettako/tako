import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { fetchServer, APIError } from '@/lib/api-client';

const SESSION_USER_COOKIE = 'tako_user';

function generateBase32Secret(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const p1 = crypto.randomBytes(2).toString('hex');
    const p2 = crypto.randomBytes(2).toString('hex');
    codes.push(`${p1}-${p2}`);
  }
  return codes;
}

function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, output: number[] = [];
  for (let i = 0; i < base32.length; i++) {
    const val = alphabet.indexOf(base32[i].toUpperCase());
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function generateTOTP(secret: string, counterOffset = 0): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30) + counterOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[19] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1000000;
  return code.toString().padStart(6, '0');
}

function verifyTOTPCode(code: string, secret: string, recoveryCodes: string[] = []): boolean {
  const cleanCode = code.trim();
  // Check recovery codes
  if (recoveryCodes.includes(cleanCode)) {
    return true;
  }
  // Check windows: counter - 1, counter, counter + 1 (drift tolerance)
  for (let offset = -1; offset <= 1; offset++) {
    if (generateTOTP(secret, offset) === cleanCode) {
      return true;
    }
  }
  return false;
}

export async function GET() {
  const cookieStore = await cookies();
  const userJson = cookieStore.get(SESSION_USER_COOKIE)?.value;
  let email = 'admin@gettako.dev';
  if (userJson) {
    try {
      email = JSON.parse(userJson).email || email;
    } catch {
      // ignore
    }
  }

  const secret = generateBase32Secret(16);
  const otpauthUrl = `otpauth://totp/TakoCloud:${encodeURIComponent(email)}?secret=${secret}&issuer=TakoCloud&algorithm=SHA1&digits=6&period=30`;
  const recoveryCodes = generateRecoveryCodes(8);

  return NextResponse.json({
    secret,
    otpauthUrl,
    recoveryCodes,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, code, secret, recoveryCodes } = body;

    const cookieStore = await cookies();
    const userJson = cookieStore.get(SESSION_USER_COOKIE)?.value;
    let currentUser = userJson ? JSON.parse(userJson) : null;

    if (action === 'disable') {
      try {
        await fetchServer('/api/v1/auth/2fa', {
          method: 'PUT',
          body: JSON.stringify({ enabled: false }),
        });
      } catch {
        // Continue
      }

      if (currentUser) {
        currentUser.twoFactorEnabled = false;
        cookieStore.set(SESSION_USER_COOKIE, JSON.stringify(currentUser), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });
      }

      return NextResponse.json({ success: true, enabled: false });
    }

    if (action === 'verify') {
      if (!code || !secret) {
        return NextResponse.json({ error: 'Code and secret are required' }, { status: 400 });
      }

      const isValid = verifyTOTPCode(code, secret, recoveryCodes || []);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid 6-digit authentication code' }, { status: 400 });
      }

      try {
        await fetchServer('/api/v1/auth/2fa', {
          method: 'PUT',
          body: JSON.stringify({
            enabled: true,
            secret,
            recoveryCodes: recoveryCodes || [],
          }),
        });
      } catch {
        // Continue
      }

      if (currentUser) {
        currentUser.twoFactorEnabled = true;
        cookieStore.set(SESSION_USER_COOKIE, JSON.stringify(currentUser), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });
      }

      return NextResponse.json({ success: true, enabled: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    if (err instanceof APIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Failed to process 2FA request' }, { status: 500 });
  }
}
