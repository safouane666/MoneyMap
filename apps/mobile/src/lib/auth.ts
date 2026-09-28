import { apiFetch } from './api';
import {
  extractSessionCookie,
  sessionCookieFromAuthPayload,
  setPersonalSpaceId,
  setSessionCookie,
} from './session';
import { loadSetupSession } from './setup-session';

export class AuthError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

async function persistAuthResponse(res: Response): Promise<void> {
  let body: unknown;
  try {
    body = await res.clone().json();
  } catch {
    body = undefined;
  }

  const fromHeader = extractSessionCookie(res);
  const fromBody = sessionCookieFromAuthPayload(body);
  const cookie = fromHeader ?? fromBody;
  if (!cookie) {
    throw new AuthError('Signed in but no session cookie was returned', res.status);
  }
  await setSessionCookie(cookie);
}

async function ensurePersonalSpace(): Promise<string> {
  const setup = await loadSetupSession();
  const res = await apiFetch('/me/setup-complete', {
    method: 'POST',
    body: JSON.stringify({
      locale: setup.locale,
      defaultCurrency: setup.currency,
      notificationEnabled: setup.notificationsEnabled,
    }),
  });
  if (res.ok) {
    const data = (await res.json()) as { spaceId?: string };
    if (data.spaceId) {
      await setPersonalSpaceId(data.spaceId);
      return data.spaceId;
    }
  }

  const spacesRes = await apiFetch('/spaces');
  if (!spacesRes.ok) {
    throw new AuthError('Could not load personal space', spacesRes.status);
  }
  const spaces = (await spacesRes.json()) as Array<{ id: string; type?: string }>;
  const personal = spaces.find((s) => s.type === 'personal') ?? spaces[0];
  if (!personal?.id) {
    throw new AuthError('No space available for this account');
  }
  await setPersonalSpaceId(personal.id);
  return personal.id;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    if (typeof body.message === 'string' && body.message) return body.message;
    if (typeof body.error === 'string' && body.error) return body.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const res = await apiFetch('/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (!res.ok) {
    throw new AuthError(await readErrorMessage(res), res.status);
  }
  await persistAuthResponse(res);
  await ensurePersonalSpace();
}

export async function signUpWithEmail(input: {
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  const res = await apiFetch('/auth/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim(),
      password: input.password,
    }),
  });
  if (!res.ok) {
    throw new AuthError(await readErrorMessage(res), res.status);
  }
  await persistAuthResponse(res);

  // Free-only v1 — best-effort subscribe; ignore failures.
  await apiFetch('/billing/subscribe', {
    method: 'POST',
    body: JSON.stringify({ plan: 'free' }),
  }).catch(() => undefined);

  await ensurePersonalSpace();
}
