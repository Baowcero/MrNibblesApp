import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { errorText } from '@/lib/api';
import { cachedGet } from '@/lib/cache';
import { formatDate, lagosToday } from '@/lib/format';
import { applyQueued, useQueue } from '@/lib/queue';
import { useSession } from '@/lib/session';
import { Badge, Body, Button, Card, ErrorNote, H1, H2, Loading, ORDER_STATUS, Row, Screen } from '@/components/ui';
import { color, font } from '@/theme';

export interface Delivery {
  id: string; order_id: string; order_no: string; status: string; delivery_date: string; business_name: string; contact_name: string | null; phone: string | null;
  address: string | null; location_label: string | null; area: string | null; items: { name: string; quantity: number }[]; bread_count: number;
  payment_status: string | null; started_at: string | null; delivered_at: string | null; failed_reason: string | null; photo_count: number;
}

const STATUS: Record<string, { label: string; tone: 'brand' | 'orange' | 'ok' | 'bad' | 'warn' }> = {
  assigned: { label: 'To deliver', tone: 'brand' }, out_for_delivery: { label: 'On the way', tone: 'orange' }, delivered: { label: 'Delivered', tone: 'ok' }, delivery_failed: { label: 'Not delivered', tone: 'bad' },
};

export default function DistributorHome() {
  const { user, signOut } = useSession();
  const { queue, failed, syncing, flush, dismissFailed } = useQueue();
  const router = useRouter();
  const [date] = useState(lagosToday());
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
  // refresh the list when the queue empties (everything synced)
  useEffect(() => { if (queue.length === 0 && !syncing) void load(); }, [queue.length, syncing, load]);

  const list = useMemo(() => (rows ?? []).map((d) => applyQueued(d, queue)), [rows, queue]);
  const todo = list.filter((d) => d.status === 'assigned' || d.status === 'out_for_delivery');
  const done = list.filter((d) => d.status === 'delivered');
  const failedList = list.filter((d) => d.status === 'delivery_failed');
  const bread = (xs: typeof list) => xs.reduce((n, d) => n + d.bread_count, 0);

  return (
    <Screen onRefresh={() => { void load(); void flush(); }} refreshing={loading && rows !== null}>
      <Row>
        <View style={{ flex: 1 }}><Body muted>Deliveries for {formatDate(date)}</Body><H1>Hello, {user?.full_name.split(' ')[0]}</H1></View>
        <Button title="Log out" variant="ghost" onPress={() => Alert.alert('Log out?', queue.length ? `${queue.length} action(s) have not been sent yet. They will wait until you log in again.` : 'You will need your password to log in again.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: () => void signOut() }])} />
      </Row>

      {queue.length > 0 && <Card tone="warn"><Body>{syncing ? 'Sending your updates…' : `${queue.length} update${queue.length === 1 ? '' : 's'} waiting to be sent. They will send when you have signal.`}</Body>{!syncing && <Button title="Send now" variant="secondary" onPress={() => void flush()} style={{ marginTop: 10 }} />}</Card>}
      {failed.length > 0 && <Card tone="bad"><H2>Some updates were not accepted</H2>{failed.map((f) => <Body key={f.event.client_event_id}>{f.message}</Body>)}<Button title="Dismiss" variant="secondary" onPress={dismissFailed} style={{ marginTop: 10 }} /></Card>}
      {stale && <Card tone="orange"><Body>You are offline. Showing the list from your last update.</Body></Card>}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[['To deliver', todo.length, bread(todo)], ['Delivered', done.length, bread(done)], ['Not delivered', failedList.length, bread(failedList)]].map(([label, n, loaves]) => (
          <Card key={String(label)} style={{ flex: 1, padding: 14 }}>
            <Text style={{ fontFamily: font.display, fontSize: 28, color: color.navy }}>{n}</Text>
            <Body muted>{label}</Body>
            <Body muted>{loaves} loaves</Body>
          </Card>
        ))}
      </View>

      {error && !rows ? <ErrorNote message={error} onRetry={load} /> : rows === null ? <Loading /> : list.length === 0 ? <Card><Body muted>No deliveries assigned to you today.</Body></Card> : (
        list.map((d) => {
          const st = STATUS[d.status] ?? { label: ORDER_STATUS[d.status]?.label ?? d.status, tone: 'brand' as const };
          return (
            <Pressable key={d.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/distributor/delivery/[id]', params: { id: d.id } })}>
              <Card>
                <Row><Text style={{ fontFamily: font.bodyBold, fontSize: 17, color: color.navy, flex: 1 }}>{d.business_name}</Text><Badge text={st.label} tone={st.tone} /></Row>
                <Body muted>{d.address ?? 'No address'}{d.area ? `, ${d.area}` : ''}</Body>
                <Row style={{ marginTop: 6 }}><Body>{d.bread_count} loaves · {d.order_no}</Body>{d.pending_sync ? <Badge text="Not sent yet" tone="warn" /> : null}</Row>
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}
