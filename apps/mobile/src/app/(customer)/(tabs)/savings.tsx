import { Text, View } from 'react-native';
import { useQuery } from '@/lib/use-query';
import { formatDateTime, formatNaira, titleCase } from '@/lib/format';
import { Body, Card, Divider, ErrorNote, H1, Icon, Loading, Row, Screen, SectionHead } from '@/components/ui';
import { color, font, tnum } from '@/theme';

interface Savings { balance_kobo: number; entries: { id: string; type: string; amount_kobo: number; balance_after_kobo: number; order_no: string | null; created_at: string }[] }

export default function SavingsTab() {
  const q = useQuery<Savings>('savings');
  return (
    <Screen onRefresh={q.reload} refreshing={q.loading && !!q.data}>
      <H1>My savings</H1>
      {q.error ? <ErrorNote message={q.error} onRetry={q.reload} /> : !q.data ? <Loading /> : (
        <>
          <View style={{ backgroundColor: color.side, borderRadius: 24, padding: 22, overflow: 'hidden', gap: 6 }}>
            <View style={{ position: 'absolute', top: -60, right: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: color.orange, opacity: 0.22 }} />
            <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: '#c9d5f2' }}>Saved so far</Text>
            <Text style={[{ fontFamily: font.display, fontSize: 44, color: '#fff', letterSpacing: -1 }, tnum]}>{formatNaira(q.data.balance_kobo)}</Text>
            <Text style={{ fontFamily: font.body, fontSize: 14.5, color: '#dbe4fa' }}>You save ₦10 on every loaf you order.</Text>
          </View>
          <SectionHead title="History" />
          {q.data.entries.length === 0 ? <Card><Body muted>Your savings will show here after your first order.</Body></Card> : (
            <Card style={{ gap: 14 }}>
              {q.data.entries.map((e, i) => (
                <View key={e.id} style={{ gap: 14 }}>
                  {i > 0 ? <Divider /> : null}
                  <Row>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: e.amount_kobo >= 0 ? color.okSoft : color.badSoft, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={e.amount_kobo >= 0 ? 'arrow-down-left' : 'arrow-up-right'} size={18} tint={e.amount_kobo >= 0 ? color.ok : color.bad} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: font.bold, color: color.navy }}>{e.order_no ?? titleCase(e.type)}</Text>
                        <Body muted style={{ fontSize: 13 }}>{formatDateTime(e.created_at)}</Body>
                      </View>
                    </View>
                    <Text style={[{ fontFamily: font.display, fontSize: 17, color: e.amount_kobo >= 0 ? color.ok : color.bad }, tnum]}>{e.amount_kobo >= 0 ? '+' : ''}{formatNaira(e.amount_kobo)}</Text>
                  </Row>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
