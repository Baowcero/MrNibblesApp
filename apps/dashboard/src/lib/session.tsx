'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export interface Profile { id: string; full_name: string; phone: string; roles: string[]; must_change_password: boolean }
interface Ctx { user: Profile | null; reload: () => Promise<void>; logout: () => Promise<void> }

const SessionCtx = createContext<Ctx>({ user: null, reload: async () => undefined, logout: async () => undefined });
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const router = useRouter();

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/session', { cache: 'no-store' });
      if (!res.ok) { router.replace('/login'); return; }
      const d = await res.json();
      setUser((d.user ?? d) as Profile);
    } catch {
      /* offline: keep what we have */
    }
  }, [router]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }, [router]);

  useEffect(() => { void reload(); }, [reload]);
  return <SessionCtx.Provider value={{ user, reload, logout }}>{children}</SessionCtx.Provider>;
}
