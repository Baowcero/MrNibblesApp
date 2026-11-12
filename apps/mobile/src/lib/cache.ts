import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

/** GET that falls back to the last good copy when there is no signal. `stale` says the copy is old. */
export async function cachedGet<T>(path: string): Promise<{ data: T; stale: boolean }> {
  const key = `mn_cache:${path}`;
  try {
    const data = await api<T>(path);
    void AsyncStorage.setItem(key, JSON.stringify(data)).catch(() => undefined);
    return { data, stale: false };
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e; // a real server answer (not a network failure) is not hidden
    const raw = await AsyncStorage.getItem(key).catch(() => null);
    if (raw) return { data: JSON.parse(raw) as T, stale: true };
    throw e;
  }
}
