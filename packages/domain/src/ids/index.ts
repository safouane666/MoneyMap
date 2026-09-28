/** Stable ID helpers (ULID-like prefix + random). */

const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomPart(length: number): string {
  let out = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += ALPHA[bytes[i]! % ALPHA.length];
  }
  return out;
}

export type IdPrefix =
  | 'user'
  | 'space'
  | 'txn'
  | 'goal'
  | 'cat'
  | 'mem'
  | 'inv'
  | 'att'
  | 'job'
  | 'aud'
  | 'set'
  | 'sub'
  | 'bill'
  | 'pturn'
  | 'psess';

export function createId(prefix: IdPrefix): string {
  return `${prefix}_${randomPart(26)}`;
}

export function createIdempotencyKey(): string {
  return `idem_${randomPart(32)}`;
}
