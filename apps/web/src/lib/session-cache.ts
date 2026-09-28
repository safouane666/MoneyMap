'use client';

const CACHE_KEYS = [
  'cm.ledger.cache.v1',
  'cm.activeSpaceId',
  'cm.demo.state.v3',
  'cm.hiddenIds.v1',
  'cm.login.prompt.dismissed',
] as const;

export function clearLocalSessionCaches() {
  if (typeof window === 'undefined') return;
  for (const key of CACHE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
