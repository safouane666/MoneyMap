import type { OfflineTransaction } from '../offline/queue';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

export async function syncTransaction(
  txn: OfflineTransaction,
): Promise<
  | {
      ok: true;
      remote: {
        id: string;
        idempotencyKey: string;
        amountMinor: number;
        updatedAt: string;
        description: string | null;
        categoryId: string | null;
        status: string;
      };
    }
  | { ok: false; error: string }
> {
  try {
    const res = await apiFetch('/transactions', {
      method: 'POST',
      body: JSON.stringify({
        id: txn.id,
        spaceId: txn.spaceId,
        type: txn.type,
        amountMinor: txn.amountMinor,
        currency: txn.currency,
        categoryId: txn.categoryId,
        description: txn.description,
        occurredAt: txn.occurredAt,
        idempotencyKey: txn.idempotencyKey,
      }),
      headers: {
        'Idempotency-Key': txn.idempotencyKey,
      },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const remote = (await res.json()) as {
      id: string;
      idempotencyKey: string;
      amountMinor: number;
      updatedAt: string;
      description: string | null;
      categoryId: string | null;
      status: string;
    };
    return { ok: true, remote };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network' };
  }
}
