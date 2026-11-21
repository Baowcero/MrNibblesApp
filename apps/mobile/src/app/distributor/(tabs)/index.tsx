import { Linking, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate } from '@/lib/format';
import { dayKind, itemsText, mapsUrl, type DeliveryView, useDeliveries } from '@/lib/deliveries';
import { DayStrip } from '@/components/day-strip';
import { Badge, Body, Button, Card, ErrorNote, H2, Icon, Loading, Row, Screen, SectionHead } from '@/components/ui';
import { color, font, tnum } from '@/theme';

/** Call and Directions chips shared by every stop. */
function StopActions({ d }: { d: DeliveryView }) {
  const maps = mapsUrl(d);
  const chip = { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, backgroundColor: color.orangeSoft } as const;
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {d.phone ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Call customer" onPress={() => void Linking.openURL(`tel:${d.phone}`)} style={chip}>
          <Icon name="phone" size={17} tint={color.navy} /><Text style={{ fontFamily: font.bold, fontSize: 14.5, color: color.navy }}>Call</Text>
        </Pressable>
      ) : null}
      {maps ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Get directions" onPress={() => void Linking.openURL(maps)} style={chip}>
          <Icon name="navigation" size={17} tint={color.navy} /><Text style={{ fontFamily: font.bold, fontSize: 14.5, color: color.navy }}>Directions</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const place = (d: DeliveryView) => [d.address, d.area].filter(Boolean).join(', ') || 'No address';

export default function DeliveriesTab() {
  const router = useRouter();
  const { date, rows, list, todo, done, failedList, stale, error, loading, reload, flush, queue, failed, syncing, dismissFailed } = useDeliveries();
  const kind = dayKind(date);
  const future = kind === 'future';
  const title = kind === 'today' ? 'Today’s route' : future ? 'Tomorrow’s route' : 'Route';
  const finished = [...done, ...failedList];
  const open = (d: DeliveryView, confirm?: boolean) =>
    router.push({ pathname: '/distributor/delivery/[id]', params: confirm ? { id: d.id, confirm: '1' } : { id: d.id } });
  const next = todo[0];
  const later = todo.slice(1);

  return (
    <Screen onRefresh={() => { void reload(); void flush(); }} refreshing={loading && rows !== null}>
      <View>
        <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: color.muted }}>{formatDate(date)}</Text>
        <Text style={{ fontFamily: font.display, fontSize: 30, color: color.navy, letterSpacing: -0.8 }}>{title}</Text>
      </View>
      <DayStrip />
      {future && <Card tone="orange" style={{ padding: 14 }}><Body>These are the deliveries assigned to you for tomorrow. The list may change until the day.</Body></Card>}

      {queue.length > 0 && (
        <Card tone="warn">
          <Body>{syncing ? 'Sending your updates…' : `${queue.length} update${queue.length === 1 ? '' : 's'} waiting to be sent. They will send when you have signal.`}</Body>
          {!syncing && <Button title="Send now" variant="secondary" onPress={() => void flush()} style={{ marginTop: 10 }} />}
        </Card>
      )}
      {failed.length > 0 && (
        <Card tone="bad">
          <H2>Some updates were not accepted</H2>
          {failed.map((f) => <Body key={f.event.client_event_id}>{f.message}</Body>)}
          <Button title="Dismiss" variant="secondary" onPress={dismissFailed} style={{ marginTop: 10 }} />
        </Card>
      )}
      {stale && <Card tone="orange"><Body>You are offline. Showing the list from your last update.</Body></Card>}

      {error && !rows ? <ErrorNote message={error} onRetry={reload} /> : rows === null ? <Loading /> : list.length === 0 ? (
        <Card><Body muted>{future ? 'Nothing assigned to you for tomorrow yet.' : kind === 'past' ? 'No deliveries on this day.' : 'No deliveries assigned to you today.'}</Body></Card>
      ) : (
        <>
          {/* progress: one segment per stop */}
          <Card tone="dark" style={{ gap: 14 }}>
            <Row>
              <Text style={[{ fontFamily: font.display, fontSize: 19, color: '#fff' }, tnum]}>{future ? `${list.length} deliveries` : `${done.length} of ${list.length} delivered`}</Text>
              <Text style={[{ fontFamily: font.bold, fontSize: 15, color: color.orange }, tnum]}>{future ? `${list.reduce((n, d) => n + d.bread_count, 0)} loaves` : `${todo.length} left`}</Text>
            </Row>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {list.map((d) => (
                <View key={d.id} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: d.status === 'delivered' ? color.orange : d.status === 'delivery_failed' ? '#c93c3c' : 'rgba(255,255,255,0.18)' }} />
              ))}
            </View>
          </Card>

          {next && !future && (
            <Card style={{ gap: 14, borderColor: color.orange, borderWidth: 2 }}>
              <Pressable accessibilityRole="button" onPress={() => open(next)} style={{ gap: 6 }}>
                <Row>
                  <Text style={{ fontFamily: font.display, fontSize: 21, color: color.navy, flex: 1, letterSpacing: -0.3 }} numberOfLines={1}>{next.business_name}</Text>
                  <Badge text={next.status === 'out_for_delivery' ? 'On the way' : 'Next stop'} tone="orange" />
                </Row>
                <Text style={{ fontFamily: font.body, fontSize: 14.5, color: color.muted }}>{place(next)}</Text>
                <Text style={[{ fontFamily: font.semi, fontSize: 17, color: color.navy, marginTop: 6 }, tnum]}>{itemsText(next.items)}</Text>
              </Pressable>
              <StopActions d={next} />
              <Button
                title={next.status === 'assigned' ? 'Open delivery' : 'Confirm delivery'}
                variant="dark"
                icon={next.status === 'assigned' ? 'arrow-right' : 'check'}
                onPress={() => open(next, next.status !== 'assigned')}
              />
            </Card>
          )}

          {(future ? todo : later).map((d) => (
            <Card key={d.id} style={{ gap: 12 }}>
              <Pressable accessibilityRole="button" onPress={() => open(d)} style={{ gap: 6 }}>
                <Row>
                  <Text style={{ fontFamily: font.bold, fontSize: 18, color: color.navy, flex: 1 }} numberOfLines={1}>{d.business_name}</Text>
                  {d.pending_sync ? <Badge text="Not sent yet" tone="warn" /> : <Badge text={d.status === 'out_for_delivery' ? 'On the way' : future ? 'Planned' : 'Pending'} tone={d.status === 'out_for_delivery' ? 'orange' : 'brand'} />}
                </Row>
                <Text style={{ fontFamily: font.body, fontSize: 14, color: color.muted }}>{place(d)}</Text>
                <Text style={[{ fontFamily: font.semi, fontSize: 16, color: color.navy, marginTop: 4 }, tnum]}>{itemsText(d.items)}</Text>
              </Pressable>
              {!future && <StopActions d={d} />}
            </Card>
          ))}

          {finished.length > 0 && (
            <>
              <SectionHead title="Done" />
              {finished.map((d) => (
                <Pressable key={d.id} accessibilityRole="button" onPress={() => open(d)}>
                  <Card style={{ padding: 16 }}>
                    <Row>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: font.bold, fontSize: 16, color: color.navy }} numberOfLines={1}>{d.business_name}</Text>
                        <Text style={[{ fontFamily: font.body, fontSize: 13.5, color: color.muted, marginTop: 2 }, tnum]}>{itemsText(d.items)}</Text>
                      </View>
                      {d.pending_sync ? <Badge text="Not sent yet" tone="warn" /> : <Badge text={d.status === 'delivered' ? 'Delivered' : 'Not delivered'} tone={d.status === 'delivered' ? 'ok' : 'bad'} />}
                    </Row>
                  </Card>
                </Pressable>
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
