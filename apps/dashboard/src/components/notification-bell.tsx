'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Icon } from './icons';

interface Note { id: string; type: string; title: string; body: string; created_at: string }

const ROUTE: Record<string, string> = { order_status: '/orders', account_update: '/customers', issue_update: '/issues' };
const TONE: Record<string, string> = { order_status: 'bg-brand-soft text-brand', account_update: 'bg-ok-soft text-ok', issue_update: 'bg-bad-soft text-bad', booking_reminder: 'bg-orange-soft text-warn' };
const ICON: Record<string, string> = { order_status: 'orders', account_update: 'people', issue_update: 'alert', booking_reminder: 'clock' };

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
}

/** Staff notifications. "Read" is remembered per person in this browser, because the server keeps no read state. */
export function NotificationBell({ userId, allowedRoutes }: { userId: string; allowedRoutes: string[] }) {
  const router = useRouter();
  const key = `mn_notif_seen_${userId}`;
  const [items, setItems] = useState<Note[]>([]);
  const [seen, setSeen] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try { setSeen(Number(localStorage.getItem(key)) || 0); } catch { setSeen(0); }
  }, [key]);

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: Note[] }>('notifications');
      setItems(res.data);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const unread = seen === null ? 0 : items.filter((n) => new Date(n.created_at).getTime() > seen).length;
  const markAll = () => {
    const t = Date.now();
    setSeen(t);
    try { localStorage.setItem(key, String(t)); } catch { /* private mode: stays unread after reload */ }
  };
  const isNew = (n: Note) => seen !== null && new Date(n.created_at).getTime() > seen;

  return (
    <div className="relative">
      <button onClick={() => { setOpen((o) => !o); if (!open) void load(); }} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-haspopup="dialog" aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-xl border border-line bg-white hover:bg-cream-2">
        <Icon name="bell" size={19} />
        {unread > 0 && <span className="absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-orange px-1 text-[11px] font-bold text-white tnum">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-bold">Notifications</h2>
              <button onClick={markAll} disabled={unread === 0} className="text-sm font-semibold text-brand disabled:text-muted/60">Mark all as read</button>
            </div>
            <div className="max-h-[26rem] overflow-auto">
              {failed && items.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted">Could not load notifications.</p>
                : items.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted">Nothing yet. New orders, sign-ups and issues show up here.</p>
                : items.map((n) => {
                  const to = ROUTE[n.type];
                  const go = to && allowedRoutes.includes(to) ? to : null;
                  return (
                    <button key={n.id} onClick={() => { setOpen(false); if (go) router.push(go); }}
                      className={`flex w-full items-start gap-3 border-b border-line/70 px-4 py-3 text-left last:border-0 hover:bg-cream/60 ${isNew(n) ? 'bg-brand-soft/30' : ''}`}>
                      <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${TONE[n.type] ?? 'bg-cream-2'}`}><Icon name={ICON[n.type] ?? 'bell'} size={17} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2"><span className="text-sm font-semibold">{n.title}</span><span className="shrink-0 text-xs text-muted">{ago(n.created_at)}</span></span>
                        <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                      </span>
                      {isNew(n) && <span className="mt-2 size-2 shrink-0 rounded-full bg-orange" aria-label="Unread" />}
                    </button>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
