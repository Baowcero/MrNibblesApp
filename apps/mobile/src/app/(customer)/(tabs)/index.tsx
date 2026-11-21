import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/lib/session';
import { useQuery } from '@/lib/use-query';
import { countdown, formatDate, greeting } from '@/lib/format';
import { OrderCard, type OrderRow } from '@/components/order-card';
import { Avatar, Body, Button, Card, ErrorNote, H2, Icon, IconButton, Loading, ORDER_STATUS, Row, Screen, SectionHead } from '@/components/ui';
import { color, font, tnum } from '@/theme';

interface Booking { delivery_date: string; is_same_day: boolean; seconds_until_close: number; delivery_window: { start: string; end: string }; message: string }

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
  const recent = orders.data?.data ?? [];
  const name = user?.customer?.business_name ?? user?.full_name;

  return (
    <Screen onRefresh={refresh} refreshing={booking.loading || orders.loading}>
      <Row>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <Avatar name={name} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.semi, fontSize: 13, color: color.muted }}>{greeting()}</Text>
            <Text style={{ fontFamily: font.display, fontSize: 21, color: color.navy, letterSpacing: -0.4 }} numberOfLines={1}>{name}</Text>
          </View>
        </View>
        <IconButton name="bell" label="Notifications" onPress={() => router.push('/notifications')} />
      </Row>

      {status === 'pending_approval' && <Card tone="warn"><H2>Waiting for approval</H2><Body>Our team is checking your account. You will get a notification as soon as you can order.</Body></Card>}
      {status === 'rejected' && <Card tone="bad"><H2>Account not approved</H2><Body>Please call the bakery so we can help you sort this out.</Body></Card>}
      {status === 'suspended' && <Card tone="bad"><H2>Account paused</H2><Body>Please call the bakery to find out why and get back to ordering.</Body></Card>}

      {active && (
        booking.error ? <ErrorNote message={booking.error} onRetry={booking.reload} /> : !booking.data ? <Loading /> : (
          <View style={{ backgroundColor: color.side, borderRadius: 24, padding: 22, overflow: 'hidden', gap: 6 }}>
            <View style={{ position: 'absolute', top: -60, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: color.orange, opacity: 0.2 }} />
            <View style={{ position: 'absolute', bottom: -80, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: color.brand, opacity: 0.25 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="clock" size={15} tint="#c9d5f2" />
              <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: '#c9d5f2' }}>{booking.data.is_same_day ? 'Order closes in' : 'Next delivery'}</Text>
            </View>
            <Text style={[{ fontFamily: font.display, fontSize: 46, color: '#fff', letterSpacing: -1 }, tnum]} accessibilityLiveRegion="polite">
              {booking.data.is_same_day && !closed ? countdown(left) : formatDate(booking.data.delivery_date)}
            </Text>
            <Text style={{ fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: '#dbe4fa' }}>
              {closed ? `Booking for today is closed. Your order will go out on ${formatDate(booking.data.delivery_date)}.` : booking.data.message}
            </Text>
            <Button title="Order bread" variant="accent" arrow onPress={() => router.push('/new-order')} style={{ marginTop: 14 }} />
          </View>
        )
      )}

      {active && recent.length > 0 && (
        <View style={{ gap: 12 }}>
          <SectionHead title="Recent orders" action="See all" onAction={() => router.push('/orders')} />
          {recent.map((o) => <OrderCard key={o.id} o={o} onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })} />)}
        </View>
      )}
    </Screen>
  );
}
