import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { errorText } from '@/lib/api';
import { cachedGet } from '@/lib/cache';
import { formatDateTime } from '@/lib/format';
import { applyQueued, useQueue } from '@/lib/queue';
import type { Delivery } from '../index';
import { Badge, Body, Button, Card, ErrorNote, H1, H2, Input, Loading, Row, Screen } from '@/components/ui';
import { color, font } from '@/theme';

const REASONS = [
  { v: 'customer_not_available', l: 'Customer not available' }, { v: 'shop_closed', l: 'Shop is closed' },
  { v: 'address_not_found', l: 'Address not found' }, { v: 'other', l: 'Something else' },
];
const LABEL: Record<string, string> = { assigned: 'To deliver', out_for_delivery: 'On the way', delivered: 'Delivered', delivery_failed: 'Not delivered' };

export default function DeliveryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { queue, enqueue } = useQueue();
  const [d, setD] = useState<Delivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'confirm' | 'fail'>('view');
  const [photos, setPhotos] = useState<string[]>([]);
  const [reason, setReason] = useState('customer_not_available');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setD((await cachedGet<Delivery>(`distributor/deliveries/${id}`)).data); setError(null); } catch (e) { setError(errorText(e)); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (queue.length === 0) void load(); }, [queue.length, load]);

  const view = useMemo(() => (d ? applyQueued(d, queue) : null), [d, queue]);

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
    setMode('view'); setPhotos([]);
  });
  const fail = () => run(async () => {
    await enqueue({ type: 'fail', delivery_id: id!, payload: { reason, ...(note.trim() ? { note: note.trim() } : {}) } });
    setMode('view'); setNote('');
  });

  const open = view && (view.status === 'assigned' || view.status === 'out_for_delivery');
  const maps = view?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${view.address}${view.area ? `, ${view.area}` : ''}, Ogbomoso`)}` : null;

  return (
    <Screen>
      <Button title="Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
      {error && !view ? <ErrorNote message={error} onRetry={load} /> : !view ? <Loading /> : (
        <>
          <Row><H1>{view.business_name}</H1></Row>
          <Row style={{ justifyContent: 'flex-start' }}><Badge text={LABEL[view.status] ?? view.status} tone={view.status === 'delivered' ? 'ok' : view.status === 'delivery_failed' ? 'bad' : view.status === 'out_for_delivery' ? 'orange' : 'brand'} />{view.pending_sync ? <Badge text="Not sent yet" tone="warn" /> : null}</Row>

          <Card style={{ gap: 6 }}>
            <H2>Where</H2>
            <Body>{view.address ?? 'No address'}{view.area ? `, ${view.area}` : ''}</Body>
            {view.contact_name ? <Body muted>{view.contact_name}</Body> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              {view.phone ? <Button title="Call" variant="secondary" onPress={() => void Linking.openURL(`tel:${view.phone}`)} style={{ flex: 1 }} /> : null}
              {maps ? <Button title="Open map" variant="secondary" onPress={() => void Linking.openURL(maps)} style={{ flex: 1 }} /> : null}
            </View>
          </Card>

          <Card style={{ gap: 6 }}>
            <H2>Bread · {view.order_no}</H2>
            {view.items.map((i) => <Row key={i.name}><Body>{i.name}</Body><Text style={{ fontFamily: font.display, fontSize: 22, color: color.navy }}>{i.quantity}</Text></Row>)}
            <Body muted>Already paid. Do not collect any money.</Body>
          </Card>

          {view.status === 'delivery_failed' && <Card tone="bad"><Body>Not delivered{view.failed_reason ? `: ${REASONS.find((r) => r.v === view.failed_reason)?.l ?? view.failed_reason}` : ''}. The bread goes back to the bakery.</Body></Card>}
          {view.status === 'delivered' && <Card tone="brand"><Body>Delivered{view.delivered_at ? ` at ${formatDateTime(view.delivered_at)}` : ''}. {view.photo_count} photo{view.photo_count === 1 ? '' : 's'} saved.</Body></Card>}

          {open && mode === 'view' && (
            <View style={{ gap: 10 }}>
              {view.status === 'assigned' && <Button title="Start delivery" onPress={start} busy={busy} />}
              <Button title="Delivered" variant={view.status === 'assigned' ? 'secondary' : 'primary'} onPress={() => setMode('confirm')} />
              <Button title="I could not deliver" variant="ghost" onPress={() => setMode('fail')} />
            </View>
          )}

          {open && mode === 'confirm' && (
            <Card style={{ gap: 12 }}>
              <H2>Take a photo of the delivery</H2>
              <Body muted>A photo is required. Show the bread at the customer's door or shop.</Body>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                {photos.map((u) => (
                  <Pressable key={u} accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setPhotos((p) => p.filter((x) => x !== u))}>
                    <Image source={{ uri: u }} style={{ width: 96, height: 96, borderRadius: 16 }} />
                  </Pressable>
                ))}
              </View>
              {photos.length < 3 && <Button title={photos.length ? 'Add another photo' : 'Take photo'} variant="secondary" onPress={takePhoto} />}
              <Button title="Confirm delivery" onPress={confirm} busy={busy} disabled={photos.length === 0} />
              <Button title="Cancel" variant="ghost" onPress={() => { setMode('view'); setPhotos([]); }} />
            </Card>
          )}

          {open && mode === 'fail' && (
            <Card style={{ gap: 12 }}>
              <H2>Why could you not deliver?</H2>
              {REASONS.map((r) => (
                <Pressable key={r.v} accessibilityRole="radio" accessibilityState={{ selected: reason === r.v }} onPress={() => setReason(r.v)}
                  style={{ padding: 14, borderRadius: 16, borderWidth: 2, borderColor: reason === r.v ? color.brand : color.line, backgroundColor: reason === r.v ? color.brandSoft : '#fff' }}>
                  <Text style={{ fontFamily: font.bodyBold, color: color.navy }}>{r.l}</Text>
                </Pressable>
              ))}
              <Input label="Note (optional)" value={note} onChangeText={setNote} maxLength={300} />
              <Button title="Confirm not delivered" variant="danger" onPress={fail} busy={busy} />
              <Button title="Cancel" variant="ghost" onPress={() => setMode('view')} />
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
