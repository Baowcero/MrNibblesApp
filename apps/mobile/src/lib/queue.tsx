import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from './api';
import { randomKey } from './format';

/**
 * Everything the distributor does (start, deliver, fail) goes through this queue, online or not.
 * Events are saved on the phone first, then sent to /distributor/sync. If there is no signal they simply
 * wait and are retried, so the app behaves the same everywhere. Each event has its own id, so a retry never repeats an action.
 */
export type QueuedEvent = {
  client_event_id: string;
  type: 'start' | 'confirm' | 'fail';
  delivery_id: string;
  occurred_at: string;
  payload?: Record<string, unknown>;
  /** Local photo files to upload before a confirm is sent. */
  photos?: string[];
  photo_keys?: string[];
};
export type FailedEvent = { event: QueuedEvent; message: string };

const QUEUE_KEY = 'mn_queue_v1';
const FAILED_KEY = 'mn_queue_failed_v1';
const NON_RETRYABLE = new Set(['invalid_payload', 'delivery_not_found', 'invalid_status_transition', 'photo_required', 'forbidden']);

async function uploadPhoto(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  const r = await api<{ key: string }>('distributor/uploads/photo', { rawBody: blob, headers: { 'Content-Type': type } });
  return r.key;
}

interface Ctx {
  queue: QueuedEvent[]; failed: FailedEvent[]; syncing: boolean;
  enqueue: (e: Omit<QueuedEvent, 'client_event_id' | 'occurred_at'>) => Promise<void>;
  flush: () => Promise<void>;
  dismissFailed: () => void;
}
const QueueContext = createContext<Ctx | null>(null);

export function QueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedEvent[]>([]);
  const [failed, setFailed] = useState<FailedEvent[]>([]);
  const [syncing, setSyncing] = useState(false);
  const ref = useRef<QueuedEvent[]>([]);
  const running = useRef(false);
  const ready = useRef(false);

  const persist = useCallback(async (next: QueuedEvent[]) => {
    ref.current = next;
    setQueue(next);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  }, []);

  const flush = useCallback(async () => {
    if (running.current || !ready.current || ref.current.length === 0) return;
    running.current = true;
    setSyncing(true);
    try {
      // 1. upload photos for confirm events (a photo that is already uploaded is not sent twice)
      for (const ev of ref.current) {
        if (ev.type !== 'confirm') continue;
        const keys = [...(ev.photo_keys ?? [])];
        for (const uri of (ev.photos ?? []).slice(keys.length)) keys.push(await uploadPhoto(uri));
        if (keys.length !== (ev.photo_keys ?? []).length) await persist(ref.current.map((e) => (e.client_event_id === ev.client_event_id ? { ...e, photo_keys: keys } : e)));
      }
      // 2. send in batches of up to 50
      while (ref.current.length > 0) {
        const batch = ref.current.slice(0, 50);
        const res = await api<{ results: { client_event_id: string; status: 'ok' | 'error'; code?: string; message?: string }[] }>('distributor/sync', {
          body: { events: batch.map((e) => ({ client_event_id: e.client_event_id, type: e.type, delivery_id: e.delivery_id, occurred_at: e.occurred_at, payload: e.type === 'confirm' ? { ...e.payload, photo_keys: e.photo_keys } : e.payload })) },
        });
        const done = new Set<string>();
        const bad: FailedEvent[] = [];
        for (const r of res.results) {
          const ev = batch.find((b) => b.client_event_id === r.client_event_id);
          if (r.status === 'ok') done.add(r.client_event_id);
          else if (ev && r.code && NON_RETRYABLE.has(r.code)) { done.add(r.client_event_id); bad.push({ event: ev, message: r.message ?? 'Could not be saved' }); }
          // any other error (for example the server is busy) stays queued and is retried
        }
        if (bad.length) { const f = [...failed, ...bad]; setFailed(f); await AsyncStorage.setItem(FAILED_KEY, JSON.stringify(f)); }
        const remaining = ref.current.filter((e) => !done.has(e.client_event_id));
        const progressed = remaining.length < ref.current.length;
        await persist(remaining);
        if (!progressed) break;
      }
    } catch (e) {
      // No signal or the server is unreachable: keep everything and try again later.
      if (e instanceof ApiError && e.status === 401) { /* logged out: leave the queue for the next login */ }
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }, [persist, failed]);

  useEffect(() => {
    (async () => {
      try {
        const q = await AsyncStorage.getItem(QUEUE_KEY);
        const f = await AsyncStorage.getItem(FAILED_KEY);
        if (q) { ref.current = JSON.parse(q) as QueuedEvent[]; setQueue(ref.current); }
        if (f) setFailed(JSON.parse(f) as FailedEvent[]);
      } catch { /* start empty */ }
      ready.current = true;
      void flush();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => void flush(), 30000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void flush(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [flush]);

  const value = useMemo<Ctx>(() => ({
    queue, failed, syncing, flush,
    enqueue: async (e) => { await persist([...ref.current, { ...e, client_event_id: randomKey(), occurred_at: new Date().toISOString() }]); void flush(); },
    dismissFailed: () => { setFailed([]); void AsyncStorage.removeItem(FAILED_KEY); },
  }), [queue, failed, syncing, flush, persist]);

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue() {
  const c = useContext(QueueContext);
  if (!c) throw new Error('useQueue must be used inside QueueProvider');
  return c;
}

/** What the screen should show for a delivery once the not-yet-synced actions are applied. */
export function applyQueued<T extends { id: string; status: string }>(d: T, queue: QueuedEvent[]): T & { pending_sync: boolean } {
  let status = d.status;
  let pending = false;
  for (const e of queue) {
    if (e.delivery_id !== d.id) continue;
    pending = true;
    if (e.type === 'start' && status === 'assigned') status = 'out_for_delivery';
    if (e.type === 'confirm') status = 'delivered';
    if (e.type === 'fail') status = 'delivery_failed';
  }
  return { ...d, status, pending_sync: pending };
}
