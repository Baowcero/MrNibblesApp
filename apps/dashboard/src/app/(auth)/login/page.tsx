'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ErrorNote, Field, Input } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
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
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-display text-4xl font-bold">Mr Nibbles<span className="text-orange">.</span></p>
          <p className="mt-2 text-muted">Staff dashboard</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-3xl bg-card p-7 shadow-soft">
          <h1 className="text-2xl font-bold">Log in</h1>
          {error && <ErrorNote message={error} />}
          <Field label="Phone number">
            <Input type="tel" inputMode="tel" autoComplete="username" placeholder="0803 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Button type="submit" busy={busy} className="w-full">Log in</Button>
          <p className="text-center text-xs text-muted">Forgot your password? Ask the CEO to reset it.</p>
        </form>
      </div>
    </main>
  );
}
