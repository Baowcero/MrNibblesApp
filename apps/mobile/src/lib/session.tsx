import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, loadTokens, saveTokens, setLoggedOutHandler } from './api';

export interface Location { id: string; label: string; address: string; area: { id: string; name: string }; is_default: boolean }
export interface User {
  id: string; full_name: string; phone: string; email: string | null; roles: string[]; must_change_password: boolean;
  customer: { id: string; business_name: string; status: string } | null; locations?: Location[];
}
interface AuthResult { access_token: string; refresh_token: string; user: User }
interface Ctx {
  user: User | null; loading: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (body: Record<string, unknown>) => Promise<void>;
  signOut: () => Promise<void>;
  setPassword: (newPassword: string) => Promise<void>;
  reload: () => Promise<void>;
}
const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try { setUser(await api<User>('me')); } catch { /* keep the current user on a network blip */ }
  }, []);

  useEffect(() => {
    setLoggedOutHandler(() => setUser(null));
    (async () => {
      if (await loadTokens()) { try { setUser(await api<User>('me')); } catch { /* offline: show login, tokens stay */ } }
      setLoading(false);
    })();
  }, []);

  const finish = useCallback(async (r: AuthResult) => {
    await saveTokens({ access: r.access_token, refresh: r.refresh_token });
    setUser(await api<User>('me'));
  }, []);

  const value = useMemo<Ctx>(() => ({
    user, loading, reload,
    signIn: async (phone, password) => finish(await api<AuthResult>('auth/login', { body: { phone, password }, auth: false })),
    signUp: async (body) => finish(await api<AuthResult>('auth/signup', { body, auth: false })),
    // Other sessions are signed out when the password changes, so the reply carries fresh tokens.
    setPassword: async (newPassword) => finish(await api<AuthResult>('auth/set-password', { body: { new_password: newPassword } })),
    signOut: async () => {
      const t = await loadTokens();
      if (t) { try { await api('auth/logout', { body: { refresh_token: t.refresh }, auth: false }); } catch { /* ignore */ } }
      await saveTokens(null);
      setUser(null);
    },
  }), [user, loading, reload, finish]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const c = useContext(SessionContext);
  if (!c) throw new Error('useSession must be used inside SessionProvider');
  return c;
}
