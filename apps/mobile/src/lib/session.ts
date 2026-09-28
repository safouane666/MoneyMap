import * as SecureStore from 'expo-secure-store';

const SESSION_COOKIE_KEY = 'cm.auth.sessionCookie';
const SPACE_ID_KEY = 'cm.auth.personalSpaceId';

/** Better Auth session cookie name (non-secure and secure variants). */
const SESSION_COOKIE_NAMES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
];

export async function getSessionCookie(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_COOKIE_KEY);
}

export async function setSessionCookie(cookieHeaderValue: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_COOKIE_KEY, cookieHeaderValue);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_COOKIE_KEY);
  await SecureStore.deleteItemAsync(SPACE_ID_KEY);
}

export async function getPersonalSpaceId(): Promise<string | null> {
  return SecureStore.getItemAsync(SPACE_ID_KEY);
}

export async function setPersonalSpaceId(spaceId: string): Promise<void> {
  await SecureStore.setItemAsync(SPACE_ID_KEY, spaceId);
}

/**
 * Extract Better Auth session cookie from a fetch Response.
 * React Native may expose a single Set-Cookie or getSetCookie().
 */
export function extractSessionCookie(res: Response): string | null {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const lines: string[] = [];
  if (typeof headers.getSetCookie === 'function') {
    lines.push(...headers.getSetCookie());
  } else {
    const single = headers.get('set-cookie');
    if (single) {
      // Some runtimes join multiple cookies with ", " — split carefully on cookie boundaries.
      for (const part of single.split(/,(?=\s*[^;=]+=[^;]+)/)) {
        lines.push(part.trim());
      }
    }
  }

  for (const line of lines) {
    for (const name of SESSION_COOKIE_NAMES) {
      if (line.startsWith(`${name}=`)) {
        const pair = line.split(';')[0]?.trim();
        if (pair) return pair;
      }
    }
  }
  return null;
}

/**
 * Prefer Set-Cookie; fall back to token fields from Better Auth JSON body.
 */
export function sessionCookieFromAuthPayload(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const token =
    (typeof record.token === 'string' && record.token) ||
    (record.session &&
      typeof record.session === 'object' &&
      typeof (record.session as { token?: unknown }).token === 'string' &&
      (record.session as { token: string }).token) ||
    null;
  if (!token) return null;
  return `better-auth.session_token=${token}`;
}
