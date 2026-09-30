import { apiFetch } from './api';
import { clearSession, getSessionCookie } from './session';

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

/** True when SecureStore has a cookie string (not validated). */
export async function hasStoredSession(): Promise<boolean> {
  const cookie = await getSessionCookie();
  return Boolean(cookie?.trim());
}

/** Hit /me; clear bad cookies and throw SessionError on 401. */
export async function requireSession(): Promise<{ id: string; email?: string | null; name?: string | null }> {
  const cookie = await getSessionCookie();
  if (!cookie) {
    throw new SessionError('Sign in required');
  }
  const res = await apiFetch('/me');
  if (res.status === 401) {
    await clearSession();
    throw new SessionError('Session expired — sign in again');
  }
  if (!res.ok) {
    throw new SessionError(`Could not verify session (${res.status})`);
  }
  const me = (await res.json()) as { id?: string; email?: string | null; name?: string | null };
  if (!me?.id) {
    await clearSession();
    throw new SessionError('Sign in required');
  }
  return { id: me.id, email: me.email, name: me.name };
}
