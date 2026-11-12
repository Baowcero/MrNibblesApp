import { Text, View } from 'react-native';
import { useQuery } from '@/lib/use-query';
import { formatDateTime, formatNaira, titleCase } from '@/lib/format';
import { Body, Card, ErrorNote, H1, H2, Loading, Row, Screen } from '@/components/ui';
import { color, font } from '@/theme';

interface Savings { balance_kobo: number; entries: { id: string; type: string; amount_kobo: number; balance_after_kobo: number; order_no: string | null; created_at: string }[] }

export default function SavingsTab() {
  const q = useQuery<Savings>('savings');
  return (
    <Screen onRefresh={q.reload} refreshing={q.loading && !!q.data}>
      <H1>My savings</H1>
      {q.error ? <ErrorNote message={q.error} onRetry={q.reload} /> : !q.data ? <Loading /> : (
        <>
          <Card tone="orange">
            <Body muted>Saved so far</Body>
            <Text style={{ fontFamily: font.display, fontSize: 44, color: color.navy }}>{formatNaira(q.data.balance_kobo)}</Text>
            <Body>You save ₦10 on every loaf you order.</Body>
          </Card>
          <H2>History</H2>
          {q.data.entries.length === 0 ? <Card><Body muted>Your savings will show here after your first order.</Body></Card> : (
            <Card style={{ gap: 14 }}>
              {q.data.entries.map((e) => (
                <Row key={e.id}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.bodyBold, color: color.navy }}>{e.order_no ?? titleCase(e.type)}</Text>
                    <Body muted>{formatDateTime(e.created_at)}</Body>
                  </View>
                  <Text style={{ fontFamily: font.display, fontSize: 18, color: e.amount_kobo >= 0 ? color.ok : color.bad }}>{e.amount_kobo >= 0 ? '+' : ''}{formatNaira(e.amount_kobo)}</Text>
                </Row>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
