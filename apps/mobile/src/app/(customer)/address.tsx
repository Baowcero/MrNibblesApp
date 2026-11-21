import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Body, Button, ErrorNote, H1, Input, Row, Screen, TopBar } from '@/components/ui';
import { color, font } from '@/theme';

interface Area { id: string; name: string }
const LABELS = ['Shop', 'Home', 'Office'];

/** Add a delivery address, or edit one when opened with an id. */
export default function AddressScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user, reload } = useSession();
  const existing = id ? user?.locations?.find((l) => l.id === id) : undefined;
  const count = user?.locations?.length ?? 0;

  const [areas, setAreas] = useState<Area[]>([]);
  const [label, setLabel] = useState(existing?.label ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [areaId, setAreaId] = useState(existing?.area.id ?? '');
  const [isDefault, setIsDefault] = useState(existing?.is_default ?? count === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void api<{ data: Area[] }>('areas', { auth: false }).then((r) => setAreas(r.data)).catch(() => undefined); }, []);

  const ready = label.trim().length >= 1 && address.trim().length >= 5 && !!areaId;

  async function save() {
    setBusy(true); setError(null);
    try {
      const body = { label: label.trim(), address: address.trim(), area_id: areaId, ...(isDefault ? { is_default: true } : {}) };
      if (existing) await api(`me/locations/${existing.id}`, { method: 'PATCH', body });
      else await api('me/locations', { method: 'POST', body });
      await reload();
      router.back();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  function remove() {
    if (!existing) return;
    Alert.alert('Remove this address?', `${existing.label}, ${existing.area.name}. Your past orders are not affected.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void (async () => {
        setBusy(true); setError(null);
        try { await api(`me/locations/${existing.id}`, { method: 'DELETE' }); await reload(); router.back(); } catch (e) { setError(errorText(e)); setBusy(false); }
      })(); } },
    ]);
  }

  return (
    <Screen footer={<Button title={existing ? 'Save address' : 'Add address'} variant="dark" onPress={save} busy={busy} disabled={!ready} />}>
      <TopBar />
      <H1>{existing ? 'Edit address' : 'New address'}</H1>
      {error ? <ErrorNote message={error} /> : null}

      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: color.navy }}>Name this address</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {LABELS.map((l) => {
            const on = label.trim().toLowerCase() === l.toLowerCase();
            return (
              <Pressable key={l} accessibilityRole="button" onPress={() => setLabel(l)} style={{ paddingHorizontal: 16, height: 40, justifyContent: 'center', borderRadius: 12, backgroundColor: on ? color.side2 : '#fff', borderWidth: 1, borderColor: on ? color.side2 : color.line }}>
                <Text style={{ fontFamily: font.semi, color: on ? '#fff' : color.navy }}>{l}</Text>
              </Pressable>
            );
          })}
        </View>
        <Input label="Label" icon="tag" value={label} onChangeText={setLabel} maxLength={40} placeholder="e.g. Shop, Home, Mama's place" />
      </View>

      <Input label="Street and landmark" icon="map-pin" value={address} onChangeText={setAddress} placeholder="House or shop number, street, landmark" multiline maxLength={200} />

      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: font.semi, fontSize: 13.5, color: color.navy }}>Area</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {areas.map((a) => (
            <Pressable key={a.id} accessibilityRole="radio" accessibilityState={{ selected: areaId === a.id }} onPress={() => setAreaId(a.id)}
              style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: areaId === a.id ? color.side2 : '#fff', borderWidth: 1, borderColor: areaId === a.id ? color.side2 : color.line }}>
              <Text style={{ fontFamily: font.semi, color: areaId === a.id ? '#fff' : color.navy }}>{a.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: color.line, padding: 14 }}>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: color.navy }}>Make this my default</Text>
            <Body muted style={{ fontSize: 13.5 }}>Used first when you order for delivery.</Body>
          </View>
          <Switch value={isDefault} onValueChange={setIsDefault} disabled={existing?.is_default || count === 0} trackColor={{ true: color.side2, false: color.line }} thumbColor="#fff" />
        </Row>
      </View>

      {existing && count > 1 ? <Button title="Remove this address" variant="ghost" icon="trash-2" onPress={remove} style={{ marginTop: 4 }} /> : null}
    </Screen>
  );
}
