import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { formatDateTime } from '@/lib/format';
import { Icon } from '@/components/ui';
import { color, font } from '@/theme';

export interface Ev { status: string; at: string; note: string | null }
export interface Step { key: string; label: string; state: 'done' | 'current' | 'todo' | 'failed'; at?: string; note?: string | null; hint?: string }

const DELIVERY = ['placed', 'paid', 'assigned', 'out_for_delivery', 'delivered'];
const PICKUP = ['placed', 'paid', 'assigned', 'ready', 'collected'];
// Each step is named for what happened, not for the order's status at that moment (so "placed" never reads as "waiting for payment" after paying).
const LABEL: Record<string, string> = {
  placed: 'Order placed', paid: 'Payment received', assigned: 'Assigned to distributor', out_for_delivery: 'On the way',
  delivered: 'Delivered', ready: 'Ready for pickup', collected: 'Collected', delivery_failed: 'Delivery failed',
};
const HINT: Record<string, string> = {
  paid: 'Waiting for your payment', assigned: 'We bake and pack your bread', out_for_delivery: 'You will get a notification',
  delivered: 'A delivery photo will be saved here', ready: 'You will get a notification', collected: 'Collect it at the bakery',
};
export const TERMINAL = ['delivered', 'collected', 'delivery_failed'];

export function buildSteps(status: string, fulfilment: 'delivery' | 'pickup', events: Ev[]): Step[] {
  const sorted = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const first = new Map<string, Ev>();
  for (const e of sorted) if (!first.has(e.status)) first.set(e.status, e);

  const failed = status === 'delivery_failed';
  const flow = [...(fulfilment === 'pickup' ? PICKUP : DELIVERY)];
  if (failed) flow[flow.length - 1] = 'delivery_failed';
  let idx = failed ? flow.length - 1 : flow.indexOf(status);
  if (idx < 0) idx = Math.max(0, ...sorted.map((e) => flow.indexOf(e.status)));
  const terminal = status === 'delivered' || status === 'collected';

  return flow.map((key, i) => {
    const ev = first.get(key);
    const state: Step['state'] = failed && i === flow.length - 1 ? 'failed' : i < idx ? 'done' : i === idx ? (terminal ? 'done' : 'current') : 'todo';
    const label = key === 'assigned' && fulfilment === 'pickup' ? 'Being prepared' : (LABEL[key] ?? key); // pickup orders have no distributor
    return { key, label, state, at: ev?.at, note: ev?.note, hint: state === 'todo' ? HINT[key] : undefined };
  });
}

function Dot({ state }: { state: Step['state'] }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (state !== 'current') return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);
  if (state === 'done') return <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: color.side2, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={14} tint="#fff" /></View>;
  if (state === 'failed') return <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: color.bad, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={14} tint="#fff" /></View>;
  if (state === 'current') {
    return (
      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: color.orange, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.4] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }) }] }} />
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color.orange }} />
      </View>
    );
  }
  return <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: color.line, backgroundColor: '#fff' }} />;
}

export function TrackTimeline({ steps }: { steps: Step[] }) {
  return (
    <View>
      {steps.map((st, i) => {
        const last = i === steps.length - 1;
        const next = steps[i + 1];
        const lineOn = !!next && next.state !== 'todo';
        const todo = st.state === 'todo';
        return (
          <View key={st.key} style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ alignItems: 'center', width: 24 }}>
              <Dot state={st.state} />
              {!last ? <View style={{ flex: 1, width: 2, marginVertical: 3, backgroundColor: lineOn ? color.side2 : color.line }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : 22, minHeight: last ? 24 : 46 }}>
              <Text style={{ fontFamily: todo ? font.semi : font.bold, fontSize: 16, color: todo ? color.muted : st.state === 'failed' ? color.bad : color.navy }}>{st.label}</Text>
              {st.at ? <Text style={{ fontFamily: font.body, fontSize: 13.5, color: color.muted, marginTop: 1 }}>{formatDateTime(st.at)}{st.note ? ` · ${st.note}` : ''}</Text>
                : st.hint ? <Text style={{ fontFamily: font.body, fontSize: 13.5, color: '#8a93a8', marginTop: 1 }}>{st.hint}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Small "Live" tag with a pulsing dot, shown while the order is still moving. */
export function LivePill() {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 0.25, duration: 700, useNativeDriver: true }), Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <View accessibilityLabel="Live updates" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.okSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.ok, opacity: a }} />
      <Text style={{ fontFamily: font.bold, fontSize: 12, color: color.ok }}>Live</Text>
    </View>
  );
}
