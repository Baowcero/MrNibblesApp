import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { formatDate, formatNaira, randomKey } from '@/lib/format';
import { payWithPaystack } from '@/lib/pay';
import { Body, Button, Card, ErrorNote, H1, H2, Loading, Row, Screen } from '@/components/ui';
import { color, font } from '@/theme';

interface Product { id: string; code: string; name: string; unit_price_kobo: number }
interface Booking { delivery_date: string; is_same_day: boolean; seconds_until_close: number; delivery_window: { start: string; end: string } }
interface Quote { items: { product_id: string; name: string; quantity: number; unit_price_kobo: number; line_total_kobo: number }[]; subtotal_kobo: number; paystack_fee_kobo: number; total_kobo: number; savings_kobo: number }
type Method = 'paystack' | 'office_cash';
type Fulfilment = 'delivery' | 'pickup';

function Choice({ label, sub, on, onPress }: { label: string; sub?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={onPress}
      style={{ flex: 1, padding: 14, borderRadius: 18, borderWidth: 2, borderColor: on ? color.brand : color.line, backgroundColor: on ? color.brandSoft : '#fff' }}>
      <Text style={{ fontFamily: font.bodyBold, fontSize: 15, color: color.navy }}>{label}</Text>
      {sub ? <Text style={{ fontFamily: font.body, fontSize: 12, color: color.muted, marginTop: 2 }}>{sub}</Text> : null}
    </Pressable>
  );
}

export default function NewOrder() {
  const router = useRouter();
  const { user } = useSession();
  const products = useQuery<{ data: Product[] }>('products');
  const booking = useQuery<Booking>('booking/status');
  const locations = useMemo(() => user?.locations ?? [], [user]);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [fulfilment, setFulfilment] = useState<Fulfilment>('delivery');
  const [locationId, setLocationId] = useState('');
  const [method, setMethod] = useState<Method>('paystack');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(randomKey()); // one key per order attempt: resending it can never double-order

  useEffect(() => { if (!locationId && locations.length) setLocationId((locations.find((l) => l.is_default) ?? locations[0]!).id); }, [locations, locationId]);

  const items = useMemo(() => Object.entries(qty).filter(([, n]) => n > 0).map(([product_id, quantity]) => ({ product_id, quantity })), [qty]);
  const loaves = items.reduce((n, i) => n + i.quantity, 0);

  useEffect(() => {
    if (items.length === 0) { setQuote(null); setQuoteError(null); return; }
    const t = setTimeout(() => {
      api<Quote>('orders/quote', { body: { items, payment_method: method } }).then((q) => { setQuote(q); setQuoteError(null); }).catch((e) => setQuoteError(errorText(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [items, method]);

  const set = (id: string, n: number) => { key.current = randomKey(); setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(100000, n)) })); };

  async function place() {
    setBusy(true);
    setError(null);
    try {
      const order = await api<{ id: string }>('orders', {
        body: { items, payment_method: method, fulfilment, ...(fulfilment === 'delivery' ? { location_id: locationId } : {}) },
        headers: { 'Idempotency-Key': key.current },
      });
      router.replace({ pathname: '/order/[id]', params: { id: order.id } });
      if (method === 'paystack') { try { await payWithPaystack(order.id); } catch { /* the order screen offers Pay now again */ } }
    } catch (e) { setError(errorText(e)); setBusy(false); }
  }

  const canPlace = loaves > 0 && !!quote && !quoteError && (fulfilment === 'pickup' || !!locationId);

  return (
    <Screen>
      <Row><H1>Order bread</H1><Button title="Close" variant="ghost" onPress={() => router.back()} /></Row>
      {booking.data && <Card tone="brand"><Body>{booking.data.is_same_day ? `Delivery today, ${booking.data.delivery_window.start} to ${booking.data.delivery_window.end}` : `Delivery on ${formatDate(booking.data.delivery_date)}`}</Body></Card>}
      {error ? <ErrorNote message={error} /> : null}

      <H2>How many loaves?</H2>
      {products.error ? <ErrorNote message={products.error} onRetry={products.reload} /> : !products.data ? <Loading /> : products.data.data.map((p) => (
        <Card key={p.id}>
          <Row>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bodyBold, fontSize: 17, color: color.navy }}>{p.name}</Text>
              <Body muted>{formatNaira(p.unit_price_kobo)} each</Body>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${p.name}`} onPress={() => set(p.id, (qty[p.id] ?? 0) - 1)} style={stepper}><Text style={stepText}>−</Text></Pressable>
              <Text style={{ minWidth: 44, textAlign: 'center', fontFamily: font.display, fontSize: 22, color: color.navy }}>{qty[p.id] ?? 0}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Add one ${p.name}`} onPress={() => set(p.id, (qty[p.id] ?? 0) + 1)} style={stepper}><Text style={stepText}>+</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Add ten ${p.name}`} onPress={() => set(p.id, (qty[p.id] ?? 0) + 10)} style={[stepper, { width: 52 }]}><Text style={[stepText, { fontSize: 15 }]}>+10</Text></Pressable>
            </View>
          </Row>
        </Card>
      ))}

      <H2>Delivery or pickup?</H2>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Choice label="Delivery" sub="We bring it to you" on={fulfilment === 'delivery'} onPress={() => setFulfilment('delivery')} />
        <Choice label="Pickup" sub="Collect at the bakery" on={fulfilment === 'pickup'} onPress={() => setFulfilment('pickup')} />
      </View>
      {fulfilment === 'delivery' && locations.map((l) => (
        <Pressable key={l.id} accessibilityRole="radio" accessibilityState={{ selected: locationId === l.id }} onPress={() => setLocationId(l.id)}
          style={{ padding: 14, borderRadius: 18, borderWidth: 2, borderColor: locationId === l.id ? color.brand : color.line, backgroundColor: '#fff' }}>
          <Text style={{ fontFamily: font.bodyBold, color: color.navy }}>{l.label}</Text>
          <Body muted>{l.address}, {l.area.name}</Body>
        </Pressable>
      ))}

      <H2>How will you pay?</H2>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Choice label="Pay online" sub="Card or transfer, small fee" on={method === 'paystack'} onPress={() => setMethod('paystack')} />
        <Choice label="Cash at office" sub="No fee" on={method === 'office_cash'} onPress={() => setMethod('office_cash')} />
      </View>

      {quoteError ? <ErrorNote message={quoteError} /> : quote ? (
        <Card style={{ gap: 8 }}>
          {quote.items.map((l) => <Row key={l.product_id}><Body>{l.quantity} × {l.name}</Body><Body>{formatNaira(l.line_total_kobo)}</Body></Row>)}
          {quote.paystack_fee_kobo > 0 && <Row><Body muted>Online payment fee</Body><Body muted>{formatNaira(quote.paystack_fee_kobo)}</Body></Row>}
          <Row style={{ marginTop: 6 }}><H2>Total</H2><Text style={{ fontFamily: font.display, fontSize: 28, color: color.navy }}>{formatNaira(quote.total_kobo)}</Text></Row>
          <Body style={{ color: color.ok }}>You save {formatNaira(quote.savings_kobo)} on this order.</Body>
        </Card>
      ) : null}

      <Button title={method === 'paystack' ? 'Place order and pay' : 'Place order'} onPress={place} busy={busy} disabled={!canPlace} />
    </Screen>
  );
}

const stepper = { width: 44, height: 44, borderRadius: 22, backgroundColor: color.cream2, alignItems: 'center', justifyContent: 'center' } as const;
const stepText = { fontFamily: font.display, fontSize: 24, color: color.navy } as const;
