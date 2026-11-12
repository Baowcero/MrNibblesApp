import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { api, errorText } from '@/lib/api';
import { formatDate, formatNaira } from '@/lib/format';
import { Badge, Body, Button, Card, ErrorNote, H1, Loading, ORDER_STATUS, Row, Screen } from '@/components/ui';
import { color, font } from '@/theme';

interface OrderRow { id: string; order_no: string; status: string; delivery_date: string; total_kobo: number; bread_count: number }
interface Page { data: OrderRow[]; next_cursor: string | null }

export default function Orders() {
  const router = useRouter();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Screen onRefresh={() => load()} refreshing={loading && rows.length > 0}>
      <H1>My orders</H1>
      {error ? <ErrorNote message={error} onRetry={() => load()} /> : null}
      {loading && rows.length === 0 ? <Loading /> : rows.length === 0 && !error ? <Card><Body muted>No orders yet. Your orders will show here.</Body></Card> : null}
      {rows.map((o) => (
        <Pressable key={o.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })}>
          <Card>
            <Row><Text style={{ fontFamily: font.bodyBold, fontSize: 16, color: color.navy }}>{o.order_no}</Text><Badge text={ORDER_STATUS[o.status]?.label ?? o.status} tone={ORDER_STATUS[o.status]?.tone} /></Row>
            <Body muted>{o.bread_count} loaves · {formatDate(o.delivery_date)}</Body>
            <Text style={{ fontFamily: font.display, fontSize: 20, color: color.navy, marginTop: 6 }}>{formatNaira(o.total_kobo)}</Text>
          </Card>
        </Pressable>
      ))}
      {cursor ? <Button title="Load more" variant="secondary" busy={loading} onPress={() => load(cursor)} /> : null}
    </Screen>
  );
}
