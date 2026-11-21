'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Button, ErrorNote, Input } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? 'Could not log in. Try again.');
        return;
      }
      router.replace('/');
    } catch {
      setError('No connection. Check your internet and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="grid flex-1 lg:grid-cols-2">
        {/* brand panel */}
        <section className="relative hidden overflow-hidden bg-side text-white lg:flex lg:flex-col lg:justify-between lg:p-12" aria-hidden="true">
          <div className="pointer-events-none absolute -top-32 -right-24 size-[34rem] rounded-full bg-orange/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -left-24 size-[30rem] rounded-full bg-brand/30 blur-3xl" />
          <div className="pointer-events-none absolute top-1/3 right-12 size-72 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute top-1/3 right-24 mt-12 size-72 rounded-full border border-white/10" />
          <p className="relative text-[28px] leading-none font-extrabold">Mr Nibbles<span className="text-orange">.</span></p>
          <div className="relative">
            <p className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">Behind every fresh loaf</p>
            <h2 className="mt-5 max-w-xl text-6xl leading-[1.05] font-bold">A little care.<br />Fresh bread,<br />every morning.</h2>
            <p className="mt-6 max-w-lg text-lg text-white/70">The workspace for the people who bake, pack and deliver Mr Nibbles to businesses across Ogbomoso.</p>
          </div>
          <p className="relative text-xs font-semibold tracking-[0.18em] text-white/70 uppercase">One bakery <span className="mx-3 text-white/40">/</span> Many deliveries</p>
        </section>

        {/* form */}
        <main className="flex flex-col px-6 py-6 sm:px-12 lg:px-16">
          <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-muted uppercase">
            <span>Mr Nibbles <span className="mx-1">/</span> Staff</span>
            <Icon name="shield" size={22} className="text-ok" />
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase"><Icon name="lock" size={16} />Secure staff access</p>
            <h1 className="mt-4 text-5xl leading-tight font-bold">Welcome back.</h1>
            <p className="mt-3 text-muted">Sign in to manage orders, production and deliveries.</p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              {error && <ErrorNote message={error} />}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Phone number</span>
                <div className="relative">
                  <Input type="tel" inputMode="tel" autoComplete="username" placeholder="0803 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} required className="h-12 pr-11" />
                  <Icon name="phone" size={18} className="pointer-events-none absolute top-3.5 right-4 text-muted" />
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Password</span>
                <div className="relative">
                  <Input type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 pr-11" />
                  <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute top-3 right-3 rounded-lg p-1 text-muted hover:text-navy"><Icon name={show ? 'eyeoff' : 'eye'} size={18} /></button>
                </div>
              </label>
              <div className="flex justify-end">
                <button type="button" onClick={() => setHelp((h) => !h)} aria-expanded={help} className="text-sm font-semibold text-orange hover:underline">Forgot password?</button>
              </div>
              {help && <p className="rounded-xl bg-cream-2 px-4 py-3 text-sm text-muted">Ask the CEO to reset your password. They will give you a temporary one to sign in with.</p>}
              <Button type="submit" busy={busy} className="h-12 w-full bg-orange text-base hover:bg-orange/90">Sign in<Icon name="arrow" size={18} /></Button>
            </form>

            <div className="mt-6 flex gap-3 rounded-2xl border border-line bg-white px-4 py-4 text-sm text-muted">
              <Icon name="info" size={20} className="mt-0.5 shrink-0" />
              <p>For authorised Mr Nibbles staff only. Contact the CEO if you need access.</p>
            </div>
          </div>

          <p className="text-xs text-muted">Mr Nibbles · Staff dashboard</p>
        </main>
      </div>
      <footer className="flex flex-wrap items-center justify-center gap-x-12 gap-y-1 bg-orange px-6 py-4 text-xs font-semibold tracking-[0.16em] text-white uppercase">
        <span>Fresh bread. Every day.</span>
        <span>Orders close 8:30 AM · Mon–Sat delivery</span>
        <span>Mr Nibbles · Staff dashboard</span>
      </footer>
    </div>
  );
}
