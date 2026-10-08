'use client';

const CACHE_KEYS = [
  'cm.ledger.cache.v1',
  'cm.ledger.cache.v2',
  'cm.activeSpaceId',
  'cm.demo.state.v3',
  'cm.demo.state.v4',
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
