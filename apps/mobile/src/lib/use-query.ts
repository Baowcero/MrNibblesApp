import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from './api';

/** Loads a GET path. Pass null to skip. `reload` fetches again with a spinner; `refresh` fetches quietly (used for live screens). */
export function useQuery<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const load = useCallback(async () => {
    if (path === null) return;
    setLoading(true);
    try { setData(await api<T>(path)); setError(null); setUpdatedAt(Date.now()); } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }, [path]);
  const refresh = useCallback(async () => {
    if (path === null) return;
    try { setData(await api<T>(path)); setError(null); setUpdatedAt(Date.now()); } catch { /* keep what is on screen; the next tick tries again */ }
  }, [path]);
  useEffect(() => { setData(null); void load(); }, [load]);
  return { data, error, loading, reload: load, refresh, updatedAt };
}
