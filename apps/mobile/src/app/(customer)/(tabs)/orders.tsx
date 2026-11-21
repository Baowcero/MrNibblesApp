import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { api, errorText } from '@/lib/api';
import { OrderCard, type OrderRow } from '@/components/order-card';
import { Body, Button, Card, ErrorNote, FilterTabs, H1, Loading, Screen } from '@/components/ui';

interface Page { data: OrderRow[]; next_cursor: string | null }
type Tab = 'all' | 'active' | 'done' | 'failed';
const ACTIVE = ['placed', 'paid', 'assigned', 'out_for_delivery', 'ready'];
const DONE = ['delivered', 'collected'];

export default function Orders() {
  const router = useRouter();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');

  const load = useCallback(async (after?: string | null) => {
    setLoading(true);
    try {
      const r = await api<Page>(`orders?limit=20${after ? `&cursor=${after}` : ''}`);
      setRows((p) => (after ? [...p, ...r.data] : r.data));
      setCursor(r.next_cursor);
      setError(null);
    } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    all: rows.length, active: rows.filter((o) => ACTIVE.includes(o.status)).length,
    done: rows.filter((o) => DONE.includes(o.status)).length, failed: rows.filter((o) => o.status === 'delivery_failed').length,
  }), [rows]);
  const shown = rows.filter((o) => tab === 'all' || (tab === 'active' && ACTIVE.includes(o.status)) || (tab === 'done' && DONE.includes(o.status)) || (tab === 'failed' && o.status === 'delivery_failed'));

  return (
    <Screen onRefresh={() => load()} refreshing={loading && rows.length > 0}>
      <H1>My orders</H1>
      <FilterTabs value={tab} onChange={setTab} tabs={[
        { key: 'all', label: 'All', count: counts.all }, { key: 'active', label: 'In progress', count: counts.active },
        { key: 'done', label: 'Completed', count: counts.done }, { key: 'failed', label: 'Failed', count: counts.failed },
      ]} />
      {error ? <ErrorNote message={error} onRetry={() => load()} /> : null}
      {loading && rows.length === 0 ? <Loading /> : shown.length === 0 && !error ? <Card><Body muted>{rows.length === 0 ? 'No orders yet. Your orders will show here.' : 'No orders in this view.'}</Body></Card> : null}
      {shown.map((o) => <OrderCard key={o.id} o={o} onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })} />)}
      {cursor ? <Button title="Load more" variant="secondary" busy={loading} onPress={() => load(cursor)} /> : null}
    </Screen>
  );
}
