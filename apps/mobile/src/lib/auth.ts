import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { apiFetch, getApiUrl } from './api';
import {
  discardGuestLedger,
  migrateGuestLedgerToSpace,
  snapshotGuestLedger,
} from './guest-migrate';
import {
  extractSessionCookie,
  sessionCookieFromAuthPayload,
  setPersonalSpaceId,
  setSessionCookie,
} from './session';
import { loadSetupSession } from './setup-session';

WebBrowser.maybeCompleteAuthSession();

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
      locale: setup.language,
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

export async function isGoogleAuthEnabled(): Promise<boolean> {
  try {
    const res = await apiFetch('/public/auth-config');
    if (!res.ok) return false;
    const data = (await res.json()) as { googleEnabled?: boolean };
    return Boolean(data.googleEnabled);
  } catch {
    return false;
  }
}

/**
 * Google OAuth via Better Auth + system browser.
 *
 * Opens the API bridge in the system browser so the OAuth state cookie is set
 * in that jar (RN fetch cookies never reach Chrome Custom Tabs). After Google,
 * `/public/mobile-google-done` deep-links back with the session.
 */
export async function signInWithGoogle(opts?: {
  /** Preserve guest ledger and migrate after sign-in (new / empty account). */
  migrateGuest?: boolean;
}): Promise<void> {
  const migrateGuest = Boolean(opts?.migrateGuest);
  if (migrateGuest) {
    await snapshotGuestLedger();
  } else {
    await discardGuestLedger();
  }

  const appCallback = Linking.createURL('auth/callback');
  const oauthBridge = new URL(`${getApiUrl()}/public/mobile-google-oauth`);
  oauthBridge.searchParams.set('to', appCallback);
  if (migrateGuest) oauthBridge.searchParams.set('migrate', '1');

  const result = await WebBrowser.openAuthSessionAsync(
    oauthBridge.toString(),
    appCallback,
  );
  if (result.type !== 'success' || !('url' in result) || !result.url) {
    throw new AuthError('Google sign-in was cancelled');
  }

  const returned = Linking.parse(result.url);
  const sessionParam =
    (typeof returned.queryParams?.session === 'string' &&
      returned.queryParams.session) ||
    null;
  if (!sessionParam) {
    throw new AuthError('Google sign-in finished but no session was returned');
  }
  await setSessionCookie(decodeURIComponent(sessionParam));

  await apiFetch('/billing/subscribe', {
    method: 'POST',
    body: JSON.stringify({ plan: 'free' }),
  }).catch(() => undefined);

  const spaceId = await ensurePersonalSpace();
  if (migrateGuest) {
    await migrateGuestLedgerToSpace(spaceId);
  }
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await discardGuestLedger();
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
  const guest = await snapshotGuestLedger();

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

  await apiFetch('/billing/subscribe', {
    method: 'POST',
    body: JSON.stringify({ plan: 'free' }),
  }).catch(() => undefined);

  const spaceId = await ensurePersonalSpace();
  await migrateGuestLedgerToSpace(spaceId, guest);
}

export function _apiBase(): string {
  return getApiUrl();
}
