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
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed', size === 'md' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-[13px]', VARIANTS[variant], className)}
    >
      {busy && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- layout pieces
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-card', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] leading-tight font-bold">{title}</h1>
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
      <p className={cx('mt-2 text-[28px] leading-tight font-bold tnum', tone === 'orange' && 'text-orange', tone === 'brand' && 'text-brand')}>{value}</p>
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
const FIELD = 'h-10 w-full rounded-xl border border-line bg-white px-4 text-sm text-navy placeholder:text-muted/70 focus:border-brand';
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
export function Modal({ open, onClose, title, subtitle, children, wide }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
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
        className={cx('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl bg-card shadow-soft', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-cream-2"><Icon name="close" /></button>
        </div>
        <div className="overflow-auto px-6 py-5">{children}</div>
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
          <tr className="border-b border-line bg-cream/70 text-xs font-semibold tracking-wide text-muted uppercase">
            {head.map((h, i) => <th key={i} className="px-4 py-3.5 whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cx('px-4 py-4 align-middle', className)}>{children}</td>;

// ---------------------------------------------------------------- redesign pieces
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return <span style={{ width: size, height: size, fontSize: size * 0.38 }} className="grid shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-dark">{initials || '?'}</span>;
}

/** Pill tabs with an optional count, like the reference screens. */
export function FilterTabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string; count?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} aria-pressed={value === t.key}
          className={cx('inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors', value === t.key ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:bg-cream-2')}>
          {t.label}
          {t.count !== undefined && <span className={cx('rounded-md px-1.5 py-0.5 text-xs tnum', value === t.key ? 'bg-white/20' : 'bg-cream-2 text-muted')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cx('relative', className)}>
      <Icon name="search" size={17} className="pointer-events-none absolute top-3 right-3.5 text-muted" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pr-10" />
    </div>
  );
}

export function DateField({ value, onChange, label, max }: { value: string; onChange: (v: string) => void; label: string; max?: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Icon name="calendar" size={17} className="pointer-events-none absolute top-3 right-3.5 bg-white text-muted" />
      <input type="date" value={value} max={max} onChange={(e) => onChange(e.target.value)} className={cx(FIELD, 'w-full pr-10')} />
    </label>
  );
}

/** Metric card: label, big number, optional change chip and hint. */
export function Kpi({ label, value, hint, delta, icon }: { label: string; value: ReactNode; hint?: ReactNode; delta?: { pct: number | null; invert?: boolean }; icon?: string }) {
  const good = delta && delta.pct !== null ? (delta.invert ? delta.pct <= 0 : delta.pct >= 0) : true;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon && <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name={icon} size={18} /></span>}
      </div>
      <p className="mt-2 text-[28px] leading-tight font-bold tnum">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
        {delta && delta.pct !== null && (
          <span className={cx('rounded-full px-2 py-0.5 font-semibold tnum', good ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}>{delta.pct >= 0 ? '+' : ''}{delta.pct.toFixed(1)}%</span>
        )}
        {hint}
      </div>
    </Card>
  );
}

export function PanelHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
      <h2 className="text-base font-bold">{title}</h2>
      {action}
    </div>
  );
}

/** Page controls under a table. Pages are 1-based. */
export function Pager({ page, pages, total, size, onPage, noun = 'orders' }: { page: number; pages: number; total: number; size: number; onPage: (p: number) => void; noun?: string }) {
  if (total === 0) return null;
  const shown = Math.min(size, total - (page - 1) * size);
  const btn = 'inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-cream-2 disabled:opacity-40 disabled:hover:bg-white';
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-4 text-sm text-muted">
      <span className="tnum">Showing {shown} of {total} {noun}</span>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={btn}><Icon name="left" size={16} />Previous</button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-2">
            {i > 0 && n - nums[i - 1]! > 1 && <span>…</span>}
            <button onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined} className={cx('size-10 rounded-xl border text-sm font-semibold tnum', n === page ? 'border-line bg-white text-navy' : 'border-transparent hover:bg-cream-2')}>{n}</button>
          </span>
        ))}
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className={btn}>Next<Icon name="right" size={16} /></button>
      </div>
    </div>
  );
}

/** Percent change from previous to current; null when there is nothing to compare with. */
export const pctChange = (cur: number, prev: number) => (prev === 0 ? null : ((cur - prev) / prev) * 100);

// Big summary card used on the redesigned screens. Pass onClick to make it a filter shortcut.
export function StatCard({ label, value, hint, onClick }: { label: string; value: string; hint?: string; onClick?: () => void }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-3 text-4xl leading-none font-bold tnum">{value}</p>
      {hint && <p className="mt-4 text-sm text-ok">{hint}</p>}
    </>
  );
  const cls = 'rounded-2xl border border-line bg-card p-6 text-left';
  return onClick ? <button onClick={onClick} className={`${cls} hover:bg-cream/50`}>{body}</button> : <div className={cls}>{body}</div>;
}
