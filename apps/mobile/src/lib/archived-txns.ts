import AsyncStorage from '@react-native-async-storage/async-storage';

/** Legacy hide key — migrated into archive on first read. */
const LEGACY_HIDDEN_KEY = 'cm.hiddenTxnIds';
const KEY = 'cm.archivedTxnIds';

async function readIds(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function loadArchivedTxnIds(): Promise<string[]> {
  const archived = await readIds(KEY);
  const legacy = await readIds(LEGACY_HIDDEN_KEY);
  if (!legacy.length) return archived;
  const merged = [...new Set([...archived, ...legacy])];
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  await AsyncStorage.removeItem(LEGACY_HIDDEN_KEY);
  return merged;
}

export async function archiveTxnId(id: string): Promise<string[]> {
  const ids = await loadArchivedTxnIds();
  if (ids.includes(id)) return ids;
  const next = [...ids, id];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function restoreArchivedTxnId(id: string): Promise<string[]> {
  const ids = await loadArchivedTxnIds();
  const next = ids.filter((hid) => hid !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

/** @deprecated Use loadArchivedTxnIds / archiveTxnId / restoreArchivedTxnId */
export const loadHiddenTxnIds = loadArchivedTxnIds;
/** @deprecated */
export const hideTxnId = archiveTxnId;
/** @deprecated */
export const unhideTxnId = restoreArchivedTxnId;
