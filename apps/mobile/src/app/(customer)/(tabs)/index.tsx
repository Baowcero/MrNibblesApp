import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { countdown, formatDate, formatNaira } from '@/lib/format';
import { Badge, Body, Button, Card, ErrorNote, H1, H2, Loading, ORDER_STATUS, Row, Screen } from '@/components/ui';
import { color, font } from '@/theme';

interface Booking { delivery_date: string; is_same_day: boolean; seconds_until_close: number; delivery_window: { start: string; end: string }; message: string }
interface OrderRow { id: string; order_no: string; status: string; delivery_date: string; total_kobo: number; bread_count: number }

export default function Home() {
  const { user, reload } = useSession();
  const router = useRouter();
  const booking = useQuery<Booking>('booking/status');
  const active = user?.customer?.status === 'active';
  const orders = useQuery<{ data: OrderRow[] }>(active ? 'orders?limit=3' : null);
  const [left, setLeft] = useState(0);

  useEffect(() => { if (booking.data) setLeft(booking.data.seconds_until_close); }, [booking.data]);
  useEffect(() => {
    if (!booking.data?.is_same_day) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [booking.data?.is_same_day]);

  const refresh = () => { void booking.reload(); void orders.reload(); void reload(); };
  const status = user?.customer?.status;
  const closed = !!booking.data && booking.data.is_same_day && left === 0;
  const latest = orders.data?.data[0];

  return (
    <Screen onRefresh={refresh} refreshing={booking.loading || orders.loading}>
      <Row>
        <View style={{ flex: 1 }}>
          <Body muted>Hello,</Body>
          <H1>{user?.customer?.business_name ?? user?.full_name}</H1>
        </View>
        <Link href="/notifications" accessibilityLabel="Notifications" style={{ fontSize: 26, padding: 8 }}>🔔</Link>
      </Row>

      {status === 'pending_approval' && <Card tone="warn"><H2>Waiting for approval</H2><Body>Our team is checking your account. You will get a notification as soon as you can order.</Body></Card>}
      {status === 'rejected' && <Card tone="bad"><H2>Account not approved</H2><Body>Please call the bakery so we can help you sort this out.</Body></Card>}
      {status === 'suspended' && <Card tone="bad"><H2>Account paused</H2><Body>Please call the bakery to find out why and get back to ordering.</Body></Card>}

      {active && (
        booking.error ? <ErrorNote message={booking.error} onRetry={booking.reload} /> : !booking.data ? <Loading /> : (
          <Card tone={closed ? 'orange' : 'brand'}>
            <Body muted>{booking.data.is_same_day ? 'Order closes in' : 'Next delivery'}</Body>
            <Text style={{ fontFamily: font.display, fontSize: 44, color: color.navy }} accessibilityLiveRegion="polite">
              {booking.data.is_same_day && !closed ? countdown(left) : formatDate(booking.data.delivery_date)}
            </Text>
            <Body>{closed ? `Booking for today is closed. Your order will go out on ${formatDate(booking.data.delivery_date)}.` : booking.data.message}</Body>
            <Button title="Order bread" onPress={() => router.push('/new-order')} style={{ marginTop: 16 }} />
          </Card>
        )
      )}

      {active && latest && (
        <View style={{ gap: 10 }}>
          <Row><H2>Latest order</H2><Link href="/orders" style={{ fontFamily: font.bodyBold, color: color.brand }}>See all</Link></Row>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/order/[id]', params: { id: latest.id } })}>
            <Card>
              <Row><Text style={{ fontFamily: font.bodyBold, fontSize: 16, color: color.navy }}>{latest.order_no}</Text><Badge text={ORDER_STATUS[latest.status]?.label ?? latest.status} tone={ORDER_STATUS[latest.status]?.tone} /></Row>
              <Body muted>{latest.bread_count} loaves · {formatDate(latest.delivery_date)}</Body>
              <Text style={{ fontFamily: font.display, fontSize: 20, color: color.navy, marginTop: 6 }}>{formatNaira(latest.total_kobo)}</Text>
            </Card>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}
