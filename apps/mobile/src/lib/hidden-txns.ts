import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cm.hiddenTxnIds';

export async function loadHiddenTxnIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function hideTxnId(id: string): Promise<string[]> {
  const ids = await loadHiddenTxnIds();
  if (ids.includes(id)) return ids;
  const next = [...ids, id];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function unhideTxnId(id: string): Promise<string[]> {
  const ids = await loadHiddenTxnIds();
  const next = ids.filter((hid) => hid !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
