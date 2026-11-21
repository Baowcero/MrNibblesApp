'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';

export interface Note { id: string; type: string; title: string; body: string; target: string | null; read: boolean; created_at: string }

interface Ctx { items: Note[]; unread: number; failed: boolean; reload: () => Promise<void>; markRead: (id: string) => void; markAll: () => void }
const NotificationsContext = createContext<Ctx>({ items: [], unread: 0, failed: false, reload: async () => undefined, markRead: () => undefined, markAll: () => undefined });

/** One copy of the staff notifications for the whole dashboard, so the bell and the home banner always agree. Read state lives on the server. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await api<{ data: Note[]; unread: number }>('notifications');
      setItems(res.data);
      setUnread(res.unread);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void reload();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 20_000);
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [reload]);

  // Shown as read straight away; the server is told in the background and the next refresh confirms it.
  const markRead = useCallback((id: string) => {
    setItems((xs) => xs.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    void api(`notifications/${id}/read`, { method: 'POST', body: {} }).catch(() => undefined);
  }, []);
  const markAll = useCallback(() => {
    setItems((xs) => xs.map((n) => ({ ...n, read: true })));
    setUnread(0);
    void api('notifications/read-all', { method: 'POST', body: {} }).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ items, unread, failed, reload, markRead, markAll }), [items, unread, failed, reload, markRead, markAll]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);
