import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { errorText } from '@/lib/api';
import { cachedGet } from '@/lib/cache';
import { dayKind, FAIL_REASONS, isOpen, mapsUrl, type Delivery } from '@/lib/deliveries';
import { formatDate, formatDateTime } from '@/lib/format';
import { applyQueued, useQueue } from '@/lib/queue';
import { Badge, Body, Button, Card, Divider, ErrorNote, Icon, Loading, Row, Screen, TopBar } from '@/components/ui';
import { color, font, tnum } from '@/theme';

const LABEL: Record<string, string> = { assigned: 'To deliver', out_for_delivery: 'On the way', delivered: 'Delivered', delivery_failed: 'Not delivered' };

export default function DeliveryDetail() {
  const { id, confirm: openConfirm } = useLocalSearchParams<{ id: string; confirm?: string }>();
  const router = useRouter();
  const { queue, enqueue } = useQueue();
  const [d, setD] = useState<Delivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(openConfirm === '1');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setD((await cachedGet<Delivery>(`distributor/deliveries/${id}`)).data); setError(null); } catch (e) { setError(errorText(e)); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (queue.length === 0) void load(); }, [queue.length, load]);

  const view = useMemo(() => (d ? applyQueued(d, queue) : null), [d, queue]);
  const later = !!view && dayKind(view.delivery_date) === 'future'; // tomorrow's deliveries can be looked at, not acted on
  const open = !!view && isOpen(view.status) && !later;
  const maps = view ? mapsUrl(view) : null;

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Camera needed', 'Please allow the camera in Settings so you can take the delivery photo.'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!r.canceled && r.assets[0]) setPhotos((p) => [...p, r.assets[0]!.uri].slice(0, 3));
  }

  async function run(fn: () => Promise<void>) { setBusy(true); try { await fn(); } finally { setBusy(false); } }
  const start = () => run(() => enqueue({ type: 'start', delivery_id: id! }));
  const confirm = () => run(async () => {
    await enqueue({ type: 'confirm', delivery_id: id!, photos, payload: { taken_at: new Date().toISOString() } });
    router.dismissAll(); // back to today's route
  });

  const footer = !open ? undefined : confirming ? (
    <View style={{ gap: 10 }}>
      <Button title="Confirm delivery" variant="dark" icon="check" onPress={confirm} busy={busy} disabled={photos.length === 0} />
      <Button title="Back" variant="secondary" onPress={() => { setConfirming(false); setPhotos([]); }} />
    </View>
  ) : (
    <View style={{ gap: 10 }}>
      {view!.status === 'assigned'
        ? <Button title="Start delivery" variant="dark" icon="play" onPress={start} busy={busy} />
        : <Button title="Confirm delivery" variant="dark" icon="check" onPress={() => setConfirming(true)} />}
      <Button title="Delivery failed" variant="secondary" onPress={() => router.push({ pathname: '/distributor/delivery/[id]/failed', params: { id: id! } })} />
    </View>
  );

  return (
    <Screen footer={footer}>
      <TopBar title={view?.business_name} />
      {error && !view ? <ErrorNote message={error} onRetry={load} /> : !view ? <Loading /> : (
        <>
          <Row style={{ justifyContent: 'flex-start', gap: 8 }}>
            <Badge text={LABEL[view.status] ?? view.status} tone={view.status === 'delivered' ? 'ok' : view.status === 'delivery_failed' ? 'bad' : view.status === 'out_for_delivery' ? 'orange' : 'brand'} />
            {view.pending_sync ? <Badge text="Not sent yet" tone="warn" /> : null}
            <Text style={[{ fontFamily: font.semi, fontSize: 13, color: color.muted }, tnum]}>{view.order_no}</Text>
          </Row>

          <Card style={{ gap: 6 }}>
            <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: color.muted }}>Deliver to</Text>
            <Text style={{ fontFamily: font.display, fontSize: 20, color: color.navy, letterSpacing: -0.3 }}>{[view.address, view.area].filter(Boolean).join(', ') || 'No address'}</Text>
            {view.contact_name || view.phone ? (
              <Text style={{ fontFamily: font.body, fontSize: 14.5, color: color.muted }}>
                {view.contact_name ? `${view.contact_name} · ` : ''}Customer phone: {view.phone ?? 'not added'}
              </Text>
            ) : null}
            {(view.phone || maps) && open ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                {view.phone ? <Button title="Call" icon="phone" variant="secondary" onPress={() => void Linking.openURL(`tel:${view.phone}`)} style={{ flex: 1 }} /> : null}
                {maps ? <Button title="Directions" icon="navigation" variant="secondary" onPress={() => void Linking.openURL(maps)} style={{ flex: 1 }} /> : null}
              </View>
            ) : null}
          </Card>

          <Card style={{ gap: 8 }}>
            {view.items.map((i) => (
              <Row key={i.name} style={{ paddingVertical: 2 }}>
                <Text style={{ fontFamily: font.bodyMedium, fontSize: 16, color: color.muted }}>{i.name}</Text>
                <Text style={[{ fontFamily: font.display, fontSize: 19, color: color.navy }, tnum]}>{i.quantity}</Text>
              </Row>
            ))}
            <Divider />
            <Row style={{ paddingVertical: 2 }}>
              <Text style={{ fontFamily: font.bodyMedium, fontSize: 16, color: color.muted }}>Payment</Text>
              <Text style={{ fontFamily: font.display, fontSize: 19, color: color.ok }}>Paid</Text>
            </Row>
            {open && <Text style={{ fontFamily: font.body, fontSize: 13, color: color.muted }}>Already paid. Do not collect any money.</Text>}
          </Card>

          {open && confirming && (
            <Card style={{ gap: 12 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 17, color: color.navy }}>Take a photo of the delivery</Text>
              <Body muted>A photo is required. Show the bread at the customer’s door or shop.</Body>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                {photos.map((u) => (
                  <Pressable key={u} accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setPhotos((p) => p.filter((x) => x !== u))}>
                    <Image source={{ uri: u }} style={{ width: 96, height: 96, borderRadius: 14 }} />
                  </Pressable>
                ))}
              </View>
              {photos.length < 3 && <Button title={photos.length ? 'Add another photo' : 'Take photo'} icon="camera" variant="secondary" onPress={takePhoto} />}
            </Card>
          )}

          {view.status === 'delivery_failed' && (
            <Card tone="bad">
              <Body>Not delivered{view.failed_reason ? `: ${FAIL_REASONS.find((r) => r.v === view.failed_reason)?.l ?? view.failed_reason}` : ''}. The bread comes back to the bakery.</Body>
            </Card>
          )}
          {later && <Card tone="orange"><Body>This delivery is for {formatDate(view.delivery_date)}. It may change until the day.</Body></Card>}
          {view.status === 'delivered' && (
            <Card tone="brand">
              <Row style={{ justifyContent: 'flex-start', gap: 10 }}>
                <Icon name="check-circle" size={20} tint={color.ok} />
                <Body style={{ flex: 1 }}>Delivered{view.delivered_at ? ` at ${formatDateTime(view.delivered_at)}` : ''}. {view.photo_count} photo{view.photo_count === 1 ? '' : 's'} saved.</Body>
              </Row>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
