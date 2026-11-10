'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorText } from './api';

/** Loads GET `path` (pass null to wait). `reload()` fetches again; old data stays visible while it does. */
export function useQuery<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (path === null) return;
    const n = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(path);
      if (n === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (n === seq.current) setError(errorText(e));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load };
}
