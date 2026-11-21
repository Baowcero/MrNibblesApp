import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { errorText } from './api';
import { cachedGet } from './cache';
import { lagosToday } from './format';
import { applyQueued, useQueue } from './queue';

export interface Delivery {
  id: string; order_id: string; order_no: string; status: string; delivery_date: string; business_name: string; contact_name: string | null; phone: string | null;
  address: string | null; location_label: string | null; area: string | null; items: { name: string; quantity: number }[]; bread_count: number;
  payment_status: string | null; started_at: string | null; delivered_at: string | null; failed_reason: string | null; photo_count: number;
}

export const FAIL_REASONS = [
  { v: 'customer_not_available', l: 'Customer not available' },
  { v: 'shop_closed', l: 'Shop closed' },
  { v: 'address_not_found', l: 'Address not found' },
  { v: 'other', l: 'Other' },
];

/** Shift a YYYY-MM-DD date by whole days. */
export const addDays = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
};

/** The day the distributor is looking at. Shared by the list, the summary and the issue report. */
const DayContext = createContext<{ date: string; setDate: (d: string) => void } | null>(null);
export function DayProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState(lagosToday());
  const value = useMemo(() => ({ date, setDate }), [date]);
  return createElement(DayContext.Provider, { value }, children);
}
export function useDay() {
  const c = useContext(DayContext);
  if (!c) throw new Error('useDay must be used inside DayProvider');
  return c;
}
/** How the selected day relates to today. */
export function dayKind(date: string): 'past' | 'today' | 'future' {
  const t = lagosToday();
  return date < t ? 'past' : date > t ? 'future' : 'today';
}

export const isOpen = (status: string) => status === 'assigned' || status === 'out_for_delivery';

/** "40 sliced, 20 unsliced": short text for a stop's bread. */
export const itemsText = (items: { name: string; quantity: number }[]) =>
  items.map((i) => `${i.quantity} ${i.name.replace(/\s*bread$/i, '').toLowerCase()}`).join(', ');

export const mapsUrl = (d: { address: string | null; area: string | null }) =>
  d.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.address}${d.area ? `, ${d.area}` : ''}, Ogbomoso`)}` : null;

/** Today's deliveries with not-yet-sent actions applied, split into what is left and what is done. */
export function useDeliveries() {
  const queueCtx = useQueue();
  const { queue, syncing, flush } = queueCtx;
  const { date } = useDay();
  const [rows, setRows] = useState<Delivery[] | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await cachedGet<{ data: Delivery[] }>(`distributor/deliveries?date=${date}`);
      setRows(r.data.data); setStale(r.stale); setError(null);
    } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }, [date]);
  useEffect(() => { void load(); }, [load]);
  // refresh once everything has been sent
  useEffect(() => { if (queue.length === 0 && !syncing) void load(); }, [queue.length, syncing, load]);

  const list = useMemo(() => (rows ?? []).map((d) => applyQueued(d, queue)), [rows, queue]);
  const todo = useMemo(() => list.filter((d) => isOpen(d.status)), [list]);
  const done = useMemo(() => list.filter((d) => d.status === 'delivered'), [list]);
  const failedList = useMemo(() => list.filter((d) => d.status === 'delivery_failed'), [list]);
  const bread = (xs: { bread_count: number }[]) => xs.reduce((n, d) => n + d.bread_count, 0);

  return { date, rows, list, todo, done, failedList, bread, stale, error, loading, reload: load, ...queueCtx };
}

export type DeliveryView = ReturnType<typeof applyQueued<Delivery>>;
