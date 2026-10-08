/** Stable ID helpers (ULID-like prefix + random). */

const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function fillRandom(bytes: Uint8Array): void {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
    return;
  }
  // Hermes / older RN: no Web Crypto until a polyfill runs (see apps/mobile/index.js).
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
}

function randomPart(length: number): string {
  let out = '';
  const bytes = new Uint8Array(length);
  fillRandom(bytes);
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
  | 'lnk'
  | 'att'
  | 'job'
  | 'aud'
  | 'set'
  | 'sub'
  | 'bill'
  | 'pturn'
  | 'psess'
  | 'sched';

export function createId(prefix: IdPrefix): string {
  return `${prefix}_${randomPart(26)}`;
}

export function createIdempotencyKey(): string {
  return `idem_${randomPart(32)}`;
}
