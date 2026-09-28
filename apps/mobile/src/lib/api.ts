import type { OfflineTransaction } from '../offline/queue';
import { getSessionCookie } from './session';

/**
 * Base URL for the Clear Money API.
 * Release / EAS profiles must set EXPO_PUBLIC_API_URL to https://YOUR_DOMAIN/cm-api
 * (never localhost or LAN). Paths below are relative to that base (e.g. /auth/…, /spaces/…).
 */
export function getApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  // Dev-only fallback for Expo Go. Production builds must set EXPO_PUBLIC_API_URL.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'http://localhost:3011';
  }

  throw new Error(
    'EXPO_PUBLIC_API_URL is required for release builds (e.g. https://YOUR_DOMAIN/cm-api)',
  );
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const cookie = await getSessionCookie();
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (cookie && !headers.has('Cookie')) {
    headers.set('Cookie', cookie);
  }

  const normalized = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${getApiUrl()}${normalized}`, {
    ...init,
    headers,
  });
}

export type SyncRemote = {
  id: string;
  idempotencyKey: string;
  amountMinor: number;
  updatedAt: string;
  description: string | null;
  categoryId: string | null;
  status: string;
};

export async function syncTransaction(
  txn: OfflineTransaction,
): Promise<{ ok: true; remote: SyncRemote } | { ok: false; error: string }> {
  try {
    const res = await apiFetch(`/spaces/${txn.spaceId}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        type: txn.type,
        amountMinor: txn.amountMinor,
        currency: txn.currency,
        categoryId: txn.categoryId,
        description: txn.description,
        occurredAt: txn.occurredAt,
        idempotencyKey: txn.idempotencyKey,
        source: 'manual',
      }),
      headers: {
        'Idempotency-Key': txn.idempotencyKey,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const remote = (await res.json()) as {
      id: string;
      idempotencyKey: string;
      amountMinor: number;
      updatedAt?: string | Date;
      description: string | null;
      categoryId: string | null;
      status: string;
    };
    return {
      ok: true,
      remote: {
        id: remote.id,
        idempotencyKey: remote.idempotencyKey,
        amountMinor: remote.amountMinor,
        updatedAt:
          typeof remote.updatedAt === 'string'
            ? remote.updatedAt
            : remote.updatedAt
              ? new Date(remote.updatedAt).toISOString()
              : new Date().toISOString(),
        description: remote.description,
        categoryId: remote.categoryId,
        status: remote.status,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network' };
  }
}
