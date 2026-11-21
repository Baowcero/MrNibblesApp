import { useRef, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { api, errorText } from '@/lib/api';
import { useDeliveries } from '@/lib/deliveries';
import { randomKey } from '@/lib/format';
import { Button, Card, Choice, ErrorNote, Icon, Input, Loading, Screen, TopBar } from '@/components/ui';
import { color, font } from '@/theme';

const TYPES = [
  { v: 'missing', l: 'Bread missing', icon: 'minus-circle' as const },
  { v: 'damaged', l: 'Bread damaged', icon: 'alert-triangle' as const },
  { v: 'wrong_quantity', l: 'Wrong quantity', icon: 'hash' as const },
  { v: 'other', l: 'Something else', icon: 'message-circle' as const },
];

async function uploadPhoto(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
  return (await api<{ key: string }>('distributor/uploads/photo', { rawBody: blob, headers: { 'Content-Type': type } })).key;
}

export default function ReportIssue() {
  const router = useRouter();
  const { list, rows, error: loadError, reload } = useDeliveries();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [type, setType] = useState('missing');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const eventId = useRef(randomKey()); // a retry after a bad network never creates a second report

  const needsQty = type !== 'other';
  const valid = !!orderId && (!needsQty || Number(qty) >= 1) && (type !== 'other' || note.trim().length >= 3);

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Camera needed', 'Please allow the camera in Settings to attach a photo.'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!r.canceled && r.assets[0]) setPhotos((p) => [...p, r.assets[0]!.uri].slice(0, 3));
  }

  async function submit() {
    setBusy(true); setError(null);
    try {
      const photo_keys: string[] = [];
      for (const u of photos) photo_keys.push(await uploadPhoto(u));
      await api(`orders/${orderId}/issues`, {
        method: 'POST',
        body: {
          issue_type: type,
          ...(needsQty ? { quantity: Number(qty) } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(photo_keys.length ? { photo_keys } : {}),
          client_event_id: eventId.current,
        },
      });
      setSent(true);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  if (sent) {
    return (
      <Screen footer={<Button title="Done" variant="dark" onPress={() => router.back()} />}>
        <TopBar title="Report an issue" />
        <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 32 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: color.okSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={30} tint={color.ok} />
          </View>
          <Text style={{ fontFamily: font.display, fontSize: 22, color: color.navy }}>Issue reported</Text>
          <Text style={{ fontFamily: font.body, fontSize: 14.5, color: color.muted, textAlign: 'center' }}>The bakery has been told and will follow it up.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title="Submit report" variant="dark" onPress={submit} busy={busy} disabled={!valid} />}>
      <TopBar title="Report an issue" />
      {loadError && !rows ? <ErrorNote message={loadError} onRetry={reload} /> : rows === null ? <Loading /> : list.length === 0 ? (
        <Card><Text style={{ fontFamily: font.body, fontSize: 15, color: color.muted }}>You have no deliveries today to report on.</Text></Card>
      ) : (
        <>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.navy }}>Which delivery?</Text>
          <Card style={{ gap: 10 }}>
            {list.map((d) => <Choice key={d.id} label={d.business_name} sub={d.order_no} on={orderId === d.order_id} onPress={() => setOrderId(d.order_id)} />)}
          </Card>

          <Text style={{ fontFamily: font.bold, fontSize: 15, color: color.navy }}>What went wrong?</Text>
          <Card style={{ gap: 10 }}>
            {TYPES.map((t) => <Choice key={t.v} label={t.l} icon={t.icon} on={type === t.v} onPress={() => setType(t.v)} />)}
          </Card>

          <Card style={{ gap: 14 }}>
            {needsQty && <Input label="How many loaves?" value={qty} onChangeText={(v) => setQty(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="e.g. 5" maxLength={6} />}
            <Input label={type === 'other' ? 'Describe the problem' : 'Notes (optional)'} placeholder="Add details" value={note} onChangeText={setNote} maxLength={500} multiline />
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {photos.map((u) => (
                <Pressable key={u} accessibilityRole="button" accessibilityLabel="Remove photo" onPress={() => setPhotos((p) => p.filter((x) => x !== u))}>
                  <Image source={{ uri: u }} style={{ width: 80, height: 80, borderRadius: 12 }} />
                </Pressable>
              ))}
            </View>
            {photos.length < 3 && <Button title="Add photo (optional)" icon="camera" variant="secondary" onPress={takePhoto} />}
          </Card>
          {error ? <Text style={{ fontFamily: font.semi, fontSize: 14, color: color.bad }}>{error}</Text> : null}
        </>
      )}
    </Screen>
  );
}
