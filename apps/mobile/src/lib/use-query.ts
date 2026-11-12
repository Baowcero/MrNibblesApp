import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from './api';

/** Loads a GET path. Pass null to skip. `reload` fetches again. */
export function useQuery<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const load = useCallback(async () => {
    if (path === null) return;
    setLoading(true);
    try { setData(await api<T>(path)); setError(null); } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }, [path]);
  useEffect(() => { setData(null); void load(); }, [load]);
  return { data, error, loading, reload: load };
}
