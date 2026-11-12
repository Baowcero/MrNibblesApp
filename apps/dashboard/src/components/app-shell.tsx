'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, errorText } from '@/lib/api';
import { NAV, homeFor, navFor } from '@/lib/nav';
import { SessionProvider, useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { formatDate, lagosToday } from '@/lib/format';
import { Icon } from './icons';
import { NotificationBell } from './notification-bell';
import { Button, ErrorNote, Field, Input, Skeleton, ToastProvider } from './ui';

function SetPassword() {
  const { reload, logout } = useSession();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== again) return setError('The two passwords do not match');
    setBusy(true);
    setError(null);
    try {
      await api('auth/set-password', { body: { new_password: pw } });
      await reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-card p-7">
        <h1 className="text-2xl font-bold">Choose your password</h1>
        <p className="text-sm text-muted">You are using a temporary password. Pick your own to continue. Use at least 8 characters with a letter and a number.</p>
        {error && <ErrorNote message={error} />}
        <Field label="New password"><Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></Field>
        <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></Field>
        <Button type="submit" busy={busy} className="w-full">Save password</Button>
        <button type="button" onClick={logout} className="w-full text-center text-sm text-muted underline">Log out</button>
      </form>
    </main>
  );
}

interface Booking { is_same_day: boolean; closes_at: string; seconds_until_close: number; delivery_date: string; delivery_window: { start: string; end: string } }

/** The small "orders are open" card at the bottom of the sidebar. */
function BookingCard() {
  const b = useQuery<Booking>('booking/status');
  useEffect(() => { const t = setInterval(() => void b.reload(), 60_000); return () => clearInterval(t); }, [b]);
  const d = b.data;
  if (!d) return <div className="rounded-xl bg-white/5 p-4"><Skeleton className="h-14 bg-white/10" /></div>;
  const open = d.is_same_day && d.seconds_until_close > 0;
  const closes = new Date(d.closes_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
  return (
    <div className="rounded-xl bg-white/5 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-white"><span className={`size-2.5 rounded-full ${open ? 'bg-emerald-400' : 'bg-orange'}`} />{open ? 'Orders are open' : 'Orders closed for today'}</p>
      <p className="mt-2 text-white/60">{open ? `Closes at ${closes} today` : `Next delivery ${formatDate(d.delivery_date)}`}</p>
      <p className="mt-1 text-white/60">Delivery {d.delivery_window.start}–{d.delivery_window.end}</p>
    </div>
  );
}

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  return now;
}

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const canSeeOrders = !!user && !user.must_change_password && user.roles.some((r) => ['ceo', 'sales', 'accounts'].includes(r));
  const sum = useQuery<{ orders_by_status: Record<string, number> }>(canSeeOrders ? `staff/orders/summary?date=${lagosToday()}` : null);
  useEffect(() => { if (!canSeeOrders) return; const t = setInterval(() => void sum.reload(), 60_000); return () => clearInterval(t); }, [canSeeOrders, sum]);
  const by = sum.data?.orders_by_status ?? {};
  const activeOrders = (['paid', 'assigned', 'out_for_delivery', 'ready'] as const).reduce((n, k) => n + (by[k] ?? 0), 0);

  const allowed = user ? NAV.find((n) => (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)))?.roles.some((r) => user.roles.includes(r)) ?? true : true;
  useEffect(() => {
    if (user && !user.must_change_password && !allowed) router.replace(homeFor(user.roles));
  }, [user, allowed, router]);
  useEffect(() => { setOpen(false); setMenu(false); }, [pathname]);

  if (!user) {
    return (
      <div className="flex min-h-screen"><div className="hidden w-72 bg-side lg:block" /><div className="flex-1 space-y-4 p-8"><Skeleton className="h-10 w-64" /><Skeleton className="h-40" /></div></div>
    );
  }
  if (user.must_change_password) return <SetPassword />;

  const items = navFor(user.roles);
  const current = items.find((n) => (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)));
  const initials = user.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const role = user.roles.filter((r) => r !== 'customer').join(', ').replace(/_/g, ' ');
  const stamp = now
    ? `${now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })} · ${now.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Lagos' }).toUpperCase()} WAT`
    : '';

  const nav = (
    <>
      <Link href={homeFor(user.roles)} className="block px-3 pt-2">
        <span className="font-display text-[28px] leading-none font-extrabold text-white">Mr Nibbles<span className="text-orange">.</span></span>
        <span className="mt-2 block text-xs font-medium tracking-wider text-white/55 uppercase">Staff dashboard</span>
      </Link>
      <nav className="mt-10 flex-1 space-y-1.5" aria-label="Main">
        {items.map((n) => {
          const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors ${active ? 'bg-cream text-navy' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
              <Icon name={n.icon} size={20} />{n.label}
              {n.href === '/orders' && activeOrders > 0 && <span className="ml-auto rounded-full bg-cream-2 px-2.5 py-0.5 text-xs font-bold text-muted tnum" aria-label={`${activeOrders} active orders today`}>{activeOrders}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 space-y-3"><BookingCard /></div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col bg-side p-5 lg:flex">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="relative flex h-full w-72 flex-col bg-side p-5" onClick={(e) => e.stopPropagation()}>{nav}</aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-line bg-white px-4 sm:px-8">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-full p-2 hover:bg-cream-2 lg:hidden"><Icon name="menu" /></button>
          <p className="hidden text-[15px] text-muted sm:block">Workspace <span className="mx-2">/</span> <span className="font-semibold text-navy">{current?.label ?? 'Dashboard'}</span></p>
          <p className="ml-auto hidden text-sm text-muted md:block tnum" suppressHydrationWarning>{stamp}</p>
          <div className="ml-auto md:ml-2"><NotificationBell userId={user.id} allowedRoutes={items.map((n) => n.href)} /></div>
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} className="flex items-center gap-3 rounded-full py-1 pr-2 pl-1 hover:bg-cream-2">
              <span className="grid size-10 place-items-center rounded-full bg-cream-2 text-sm font-bold">{initials}</span>
              <span className="hidden text-left sm:block"><span className="block text-sm leading-tight font-semibold">{user.full_name}</span><span className="block text-xs text-muted capitalize">{role}</span></span>
              <Icon name="chevron" size={18} className="text-muted" />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                <div role="menu" className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-line bg-white p-1.5 shadow-soft">
                  <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-cream-2"><Icon name="logout" size={16} />Log out</button>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">{allowed ? children : null}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <Shell>{children}</Shell>
      </ToastProvider>
    </SessionProvider>
  );
}
