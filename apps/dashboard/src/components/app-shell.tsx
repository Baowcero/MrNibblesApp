'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, errorText } from '@/lib/api';
import { NAV, homeFor, navFor } from '@/lib/nav';
import { SessionProvider, useSession } from '@/lib/session';
import { Icon } from './icons';
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
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl bg-card p-7 shadow-soft">
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

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const allowed = user ? NAV.find((n) => (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)))?.roles.some((r) => user.roles.includes(r)) ?? true : true;
  useEffect(() => {
    if (user && !user.must_change_password && !allowed) router.replace(homeFor(user.roles));
  }, [user, allowed, router]);
  useEffect(() => setOpen(false), [pathname]);

  if (!user) {
    return (
      <div className="flex min-h-screen"><div className="hidden w-64 p-4 lg:block"><Skeleton className="h-full" /></div><div className="flex-1 space-y-4 p-8"><Skeleton className="h-10 w-64" /><Skeleton className="h-40" /></div></div>
    );
  }
  if (user.must_change_password) return <SetPassword />;

  const items = navFor(user.roles);
  const nav = (
    <>
      <Link href={homeFor(user.roles)} className="mb-8 block px-3 font-display text-2xl font-bold">Mr Nibbles<span className="text-orange">.</span></Link>
      <nav className="flex-1 space-y-1" aria-label="Main">
        {items.map((n) => {
          const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${active ? 'bg-brand text-white' : 'text-navy hover:bg-cream-2'}`}>
              <Icon name={n.icon} size={18} />{n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 rounded-2xl bg-cream-2 p-4">
        <p className="truncate text-sm font-semibold">{user.full_name}</p>
        <p className="mb-3 text-xs text-muted capitalize">{user.roles.filter((r) => r !== 'customer').join(', ').replace(/_/g, ' ')}</p>
        <button onClick={logout} className="flex items-center gap-2 text-sm font-semibold text-brand"><Icon name="logout" size={16} />Log out</button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line p-4 lg:flex">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-navy/30" />
          <aside className="relative flex h-full w-72 flex-col bg-cream p-4" onClick={(e) => e.stopPropagation()}>{nav}</aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-full p-2 hover:bg-cream-2"><Icon name="menu" /></button>
          <span className="font-display text-lg font-bold">Mr Nibbles<span className="text-orange">.</span></span>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-8">{allowed ? children : null}</main>
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
