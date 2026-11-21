import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate } from '@/lib/format';
import { dayKind, useDeliveries } from '@/lib/deliveries';
import { DayStrip } from '@/components/day-strip';
import { Button, Card, Divider, ErrorNote, Loading, Row, Screen } from '@/components/ui';
import { color, font, tnum } from '@/theme';

function Line({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Row style={{ paddingVertical: 4 }}>
      <Text style={{ fontFamily: font.bodyMedium, fontSize: 16, color: color.muted }}>{label}</Text>
      <Text style={[{ fontFamily: font.display, fontSize: 19, color: tone ?? color.navy }, tnum]}>{value}</Text>
    </Row>
  );
}

export default function SummaryTab() {
  const router = useRouter();
  const { date, rows, list, todo, done, failedList, bread, error, loading, reload, flush } = useDeliveries();

  return (
    <Screen onRefresh={() => { void reload(); void flush(); }} refreshing={loading && rows !== null}>
      <View>
        <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: color.muted }}>{formatDate(date)}</Text>
        <Text style={{ fontFamily: font.display, fontSize: 30, color: color.navy, letterSpacing: -0.8 }}>Day summary</Text>
      </View>
      <DayStrip />

      {error && !rows ? <ErrorNote message={error} onRetry={reload} /> : rows === null ? <Loading /> : (
        <>
          <Card style={{ gap: 6, paddingVertical: 18 }}>
            <Line label="Delivered" value={`${done.length} of ${list.length}`} tone={color.ok} />
            <Divider />
            <Line label="Failed" value={failedList.length} tone={failedList.length ? color.bad : undefined} />
            <Divider />
            <Line label="Bread delivered" value={bread(done)} />
            <Divider />
            <Line label="Bread returned" value={bread(failedList)} />
            {todo.length > 0 && (<><Divider /><Line label={dayKind(date) === 'future' ? 'Planned' : 'Still to deliver'} value={todo.length} tone={color.warn} /></>)}
          </Card>
          {failedList.length > 0 && dayKind(date) !== 'future' && (
            <Card tone="orange" style={{ padding: 14 }}>
              <Text style={{ fontFamily: font.semi, fontSize: 14, color: color.navy }}>
                Bring {bread(failedList)} undelivered loaves back to the bakery.
              </Text>
            </Card>
          )}
          {dayKind(date) !== 'future' && <Button title="Report an issue" variant="secondary" icon="alert-circle" onPress={() => router.push('/distributor/report')} />}
        </>
      )}
    </Screen>
  );
}
