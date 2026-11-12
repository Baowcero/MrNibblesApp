import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, errorText } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { formatDate, formatDateTime, formatNaira, titleCase } from '@/lib/format';
import { payWithPaystack, verifyPayment } from '@/lib/pay';
import { Badge, Body, Button, Card, ErrorNote, H1, H2, Input, Loading, ORDER_STATUS, Row, Screen } from '@/components/ui';
import { color, font } from '@/theme';

interface Detail {
  id: string; order_no: string; status: string; fulfilment: 'delivery' | 'pickup'; delivery_date: string;
  location: { label: string; address: string; area: string } | null;
  items: { product_id: string; name: string; quantity: number; unit_price_kobo: number; line_total_kobo: number }[];
  subtotal_kobo: number; paystack_fee_kobo: number; total_kobo: number; savings_kobo: number;
  payment: { method: 'paystack' | 'office_cash'; status: string } | null; timeline: { status: string; at: string; note: string | null }[];
}
const CAN_REPORT = ['out_for_delivery', 'delivered', 'delivery_failed', 'ready', 'collected'];
const ISSUES = [{ v: 'missing', l: 'Missing bread' }, { v: 'damaged', l: 'Damaged bread' }, { v: 'wrong_quantity', l: 'Wrong quantity' }, { v: 'other', l: 'Something else' }];

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useQuery<Detail>(id ? `orders/${id}` : null);
  const o = q.data;
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [type, setType] = useState('damaged');
  const [count, setCount] = useState('');
  const [note, setNote] = useState('');

  async function run(name: string, fn: () => Promise<string | void>) {
    setBusy(name); setMsg(null);
    try { const text = await fn(); if (text) setMsg({ text }); await q.reload(); } catch (e) { setMsg({ text: errorText(e), bad: true }); } finally { setBusy(null); }
  }

  const unpaid = !!o && o.status === 'placed' && o.payment?.status !== 'succeeded';
  const payOnline = () => run('pay', async () => ((await payWithPaystack(id!)) ? 'Payment received. Thank you!' : 'We have not received the payment yet. If you paid, tap "I have paid".'));
  const checkPaid = () => run('check', async () => ((await verifyPayment(id!)) ? 'Payment received. Thank you!' : 'Not received yet. Please wait a moment and try again.'));
  const switchMethod = (m: 'paystack' | 'office_cash') => run('switch', async () => { await api(`orders/${id}/payment-method`, { body: { payment_method: m } }); return m === 'office_cash' ? 'Okay. Pay cash at the office and we will mark it paid.' : undefined; });
  const report = () => run('report', async () => {
    await api(`orders/${id}/issues`, { body: { issue_type: type, ...(type !== 'other' && count ? { quantity: Math.round(Number(count)) } : {}), ...(note.trim() ? { note: note.trim() } : {}) } });
    setReporting(false); setNote(''); setCount('');
    return 'Thank you. We have your report and will get back to you.';
  });

  return (
    <Screen onRefresh={q.reload} refreshing={q.loading && !!o}>
      <Button title="Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
      {q.error ? <ErrorNote message={q.error} onRetry={q.reload} /> : !o ? <Loading /> : (
        <>
          <Row><H1>{o.order_no}</H1><Badge text={ORDER_STATUS[o.status]?.label ?? o.status} tone={ORDER_STATUS[o.status]?.tone} /></Row>
          <Body muted>{o.fulfilment === 'delivery' ? `Delivery on ${formatDate(o.delivery_date)}` : `Pickup on ${formatDate(o.delivery_date)}`}</Body>
          {msg ? (msg.bad ? <ErrorNote message={msg.text} /> : <Card tone="brand"><Body>{msg.text}</Body></Card>) : null}

          {unpaid && (
            <Card tone="warn" style={{ gap: 10 }}>
              <H2>{o.payment?.method === 'office_cash' ? 'Pay cash at the office' : 'Payment needed'}</H2>
              {o.payment?.method === 'paystack' ? (
                <>
                  <Button title={`Pay ${formatNaira(o.total_kobo)} now`} onPress={payOnline} busy={busy === 'pay'} />
                  <Button title="I have paid" variant="secondary" onPress={checkPaid} busy={busy === 'check'} />
                  <Button title="Pay cash at the office instead" variant="ghost" onPress={() => switchMethod('office_cash')} busy={busy === 'switch'} />
                </>
              ) : (
                <>
                  <Body>Bring {formatNaira(o.total_kobo)} to the office. We will mark your order paid.</Body>
                  <Button title="Pay online instead" variant="secondary" onPress={() => switchMethod('paystack')} busy={busy === 'switch'} />
                </>
              )}
            </Card>
          )}

          <Card style={{ gap: 8 }}>
            {o.items.map((i) => <Row key={i.product_id}><Body>{i.quantity} × {i.name}</Body><Body>{formatNaira(i.line_total_kobo)}</Body></Row>)}
            {o.paystack_fee_kobo > 0 && <Row><Body muted>Online payment fee</Body><Body muted>{formatNaira(o.paystack_fee_kobo)}</Body></Row>}
            <Row style={{ marginTop: 6 }}><H2>Total</H2><Text style={{ fontFamily: font.display, fontSize: 24, color: color.navy }}>{formatNaira(o.total_kobo)}</Text></Row>
            <Body muted>{o.payment ? `${o.payment.method === 'paystack' ? 'Online' : 'Cash'} · ${o.payment.status === 'succeeded' ? 'Paid' : titleCase(o.payment.status)}` : ''}</Body>
          </Card>

          {o.location && <Card><H2>Delivering to</H2><Body>{o.location.address}, {o.location.area}</Body></Card>}

          <Card style={{ gap: 12 }}>
            <H2>Progress</H2>
            {o.timeline.map((t, i) => (
              <View key={`${t.status}-${i}`} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 5, backgroundColor: i === o.timeline.length - 1 ? color.brand : color.line }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.bodyBold, color: color.navy }}>{ORDER_STATUS[t.status]?.label ?? titleCase(t.status)}</Text>
                  <Body muted>{formatDateTime(t.at)}{t.note ? ` · ${t.note}` : ''}</Body>
                </View>
              </View>
            ))}
          </Card>

          {CAN_REPORT.includes(o.status) && (reporting ? (
            <Card style={{ gap: 12 }}>
              <H2>Report a problem</H2>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ISSUES.map((x) => <Button key={x.v} title={x.l} variant={type === x.v ? 'primary' : 'secondary'} onPress={() => setType(x.v)} style={{ minHeight: 40, paddingHorizontal: 16 }} />)}
              </View>
              {type !== 'other' && <Input label="How many loaves" value={count} onChangeText={setCount} keyboardType="number-pad" />}
              <Input label={type === 'other' ? 'Tell us what happened' : 'Note (optional)'} value={note} onChangeText={setNote} multiline maxLength={500} />
              <Button title="Send report" onPress={report} busy={busy === 'report'} disabled={type === 'other' ? note.trim().length < 3 : !count} />
              <Button title="Cancel" variant="ghost" onPress={() => setReporting(false)} />
            </Card>
          ) : <Button title="Report a problem" variant="secondary" onPress={() => setReporting(true)} />)}
        </>
      )}
    </Screen>
  );
}
