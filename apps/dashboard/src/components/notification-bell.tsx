'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications, type Note } from '@/lib/notifications';
import { Icon } from './icons';

const TYPE_ROUTE: Record<string, string> = { order_status: '/orders', account_update: '/customers', issue_update: '/issues' };
const TARGET_ROUTE: Record<string, string> = { order: '/orders', customer: '/customers', issue: '/issues', stock: '/inventory' };
const TONE: Record<string, string> = { order_status: 'bg-brand-soft text-brand', account_update: 'bg-ok-soft text-ok', issue_update: 'bg-bad-soft text-bad', booking_reminder: 'bg-orange-soft text-warn' };
const ICON: Record<string, string> = { order_status: 'orders', account_update: 'people', issue_update: 'alert', booking_reminder: 'clock' };

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
}

/** Where a notification opens: by what it is about, otherwise by its kind. */
const routeFor = (n: Note) => TARGET_ROUTE[n.target?.split(':')[0] ?? ''] ?? TYPE_ROUTE[n.type];

/** Staff notifications. Opening one marks it read and takes you to the right screen. */
export function NotificationBell({ allowedRoutes }: { userId?: string; allowedRoutes: string[] }) {
  const router = useRouter();
  const { items, unread, failed, reload, markRead, markAll } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => { setOpen((o) => !o); if (!open) void reload(); }} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-haspopup="dialog" aria-expanded={open}
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
                : items.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted">Nothing yet. New orders, payments, deliveries, issues and sign-ups show up here.</p>
                : items.map((n) => {
                  const to = routeFor(n);
                  const go = to && allowedRoutes.includes(to) ? to : null;
                  return (
                    <button key={n.id} onClick={() => { if (!n.read) markRead(n.id); setOpen(false); if (go) router.push(go); }}
                      className={`flex w-full items-start gap-3 border-b border-line/70 px-4 py-3 text-left last:border-0 hover:bg-cream/60 ${n.read ? '' : 'bg-brand-soft/30'}`}>
                      <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${TONE[n.type] ?? 'bg-cream-2'}`}><Icon name={ICON[n.type] ?? 'bell'} size={17} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2"><span className={`text-sm ${n.read ? 'font-medium' : 'font-semibold'}`}>{n.title}</span><span className="shrink-0 text-xs text-muted">{ago(n.created_at)}</span></span>
                        <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                      </span>
                      {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-orange" aria-label="Unread" />}
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
