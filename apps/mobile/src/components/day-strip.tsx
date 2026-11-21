import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { addDays, useDay } from '@/lib/deliveries';
import { lagosToday } from '@/lib/format';
import { color, font, tnum } from '@/theme';

const wd = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
};

/** The last 7 days, today and tomorrow. Today is opened first. */
export function DayStrip() {
  const { date, setDate } = useDay();
  const today = lagosToday();
  const days = Array.from({ length: 9 }, (_, i) => addDays(today, i - 7));
  const scroller = useRef<{ scrollToEnd: (o: { animated: boolean }) => void } | null>(null);
  useEffect(() => { const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 0); return () => clearTimeout(t); }, []);

  return (
    <ScrollView ref={(r) => { scroller.current = r; }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} style={{ marginHorizontal: -20, flexGrow: 0 }}>
      {days.map((d) => {
        const on = d === date;
        return (
          <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={d === today ? 'Today' : d > today ? 'Tomorrow' : d} onPress={() => setDate(d)}
            style={{ width: 56, paddingVertical: 10, borderRadius: 16, alignItems: 'center', gap: 2, backgroundColor: on ? color.side2 : '#fff', borderWidth: 1, borderColor: on ? color.side2 : color.line }}>
            <Text style={{ fontFamily: font.semi, fontSize: 12, color: on ? 'rgba(255,255,255,0.75)' : color.muted }}>{d === today ? 'Today' : d > today ? 'Tmrw' : wd(d)}</Text>
            <Text style={[{ fontFamily: font.display, fontSize: 18, color: on ? '#fff' : color.navy }, tnum]}>{Number(d.slice(8))}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
