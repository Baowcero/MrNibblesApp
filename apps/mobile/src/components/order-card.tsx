import { Pressable, Text, View } from 'react-native';
import { formatDate, formatNaira } from '@/lib/format';
import { Badge, Card, Icon, ORDER_STATUS, Row } from '@/components/ui';
import { color, font, tnum } from '@/theme';

export interface OrderRow { id: string; order_no: string; status: string; delivery_date: string; total_kobo: number; bread_count: number }

export function OrderCard({ o, onPress }: { o: OrderRow; onPress: () => void }) {
  const st = ORDER_STATUS[o.status];
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={{ gap: 10 }}>
        <Row>
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: color.navy }}>{o.order_no}</Text>
          <Badge text={st?.label ?? o.status} tone={st?.tone} />
        </Row>
        <Row>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="calendar" size={14} tint={color.muted} />
            <Text style={{ fontFamily: font.body, fontSize: 14, color: color.muted }}>{o.bread_count} loaves · {formatDate(o.delivery_date)}</Text>
          </View>
          <Text style={[{ fontFamily: font.display, fontSize: 18, color: color.navy }, tnum]}>{formatNaira(o.total_kobo)}</Text>
        </Row>
      </Card>
    </Pressable>
  );
}

