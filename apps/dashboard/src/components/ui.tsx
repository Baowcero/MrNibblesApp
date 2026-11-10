'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './icons';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------- buttons
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-brand/40',
  secondary: 'bg-white text-navy border border-line hover:bg-cream-2 disabled:text-muted/60',
  ghost: 'text-brand hover:bg-brand-soft disabled:text-muted/60',
  danger: 'bg-bad text-white hover:opacity-90 disabled:opacity-40',
};

export function Button({ variant = 'primary', size = 'md', busy, className, children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={cx('inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed', size === 'md' ? 'h-11 px-5 text-sm' : 'h-9 px-4 text-sm', VARIANTS[variant], className)}
    >
      {busy && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- layout pieces
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-3xl bg-card shadow-soft', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'orange' | 'brand' }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className={cx('mt-2 font-display text-4xl font-bold', tone === 'orange' && 'text-orange', tone === 'brand' && 'text-brand')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

const TONES = {
  neutral: 'bg-cream-2 text-navy', brand: 'bg-brand-soft text-brand-dark', ok: 'bg-ok-soft text-ok',
  bad: 'bg-bad-soft text-bad', warn: 'bg-warn-soft text-warn', orange: 'bg-orange-soft text-warn',
};
export type Tone = keyof typeof TONES;

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', TONES[tone])}>{children}</span>;
}

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  placed: { label: 'Awaiting payment', tone: 'warn' }, paid: { label: 'Paid', tone: 'brand' }, assigned: { label: 'Assigned', tone: 'brand' },
  out_for_delivery: { label: 'Out for delivery', tone: 'orange' }, delivered: { label: 'Delivered', tone: 'ok' },
  ready: { label: 'Ready for pickup', tone: 'orange' }, collected: { label: 'Collected', tone: 'ok' }, delivery_failed: { label: 'Delivery failed', tone: 'bad' },
};
export const CUSTOMER_STATUS: Record<string, { label: string; tone: Tone }> = {
  unclaimed: { label: 'Not signed up', tone: 'neutral' }, pending_approval: { label: 'Awaiting approval', tone: 'warn' },
  active: { label: 'Active', tone: 'ok' }, rejected: { label: 'Rejected', tone: 'bad' }, suspended: { label: 'Suspended', tone: 'bad' },
};

export function StatusBadge({ status, map = ORDER_STATUS }: { status: string; map?: Record<string, { label: string; tone: Tone }> }) {
  const s = map[status] ?? { label: status, tone: 'neutral' as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-cream-2', className)} />;
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{text}</p>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">
      <span>{message}</span>
      {onRetry && <button onClick={onRetry} className="font-semibold underline">Try again</button>}
    </div>
  );
}

// ---------------------------------------------------------------- forms
const FIELD = 'h-11 w-full rounded-2xl border border-line bg-white px-4 text-sm text-navy placeholder:text-muted/70 focus:border-brand';
export function Input({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(FIELD, className)} />;
}
export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(FIELD, 'pr-8', className)} />;
}
export function Field({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  );
}

// ---------------------------------------------------------------- overlays
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={cx('max-h-[90vh] w-full overflow-auto rounded-3xl bg-card p-6 shadow-soft', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-cream-2"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/30" onMouseDown={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} className="h-full w-full max-w-lg overflow-auto bg-cream p-6 shadow-soft">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-cream-2"><Icon name="close" /></button>
        </div>
        {children}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- toasts
const ToastCtx = createContext<(msg: string, tone?: 'ok' | 'bad') => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; tone: 'ok' | 'bad' }[]>([]);
  const push = useCallback((msg: string, tone: 'ok' | 'bad' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed right-4 bottom-4 z-[60] flex flex-col gap-2" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={cx('rounded-2xl px-4 py-3 text-sm font-semibold shadow-soft', i.tone === 'ok' ? 'bg-navy text-white' : 'bg-bad text-white')}>{i.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------------------------------------------------------------- table
export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs font-semibold tracking-wide text-muted uppercase">
            {head.map((h, i) => <th key={i} className="px-4 py-3 whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cx('px-4 py-3 align-middle', className)}>{children}</td>;
