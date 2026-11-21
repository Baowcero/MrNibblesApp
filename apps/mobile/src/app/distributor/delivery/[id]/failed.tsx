import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FAIL_REASONS } from '@/lib/deliveries';
import { useQueue } from '@/lib/queue';
import { Button, Card, Choice, Input, Screen, TopBar } from '@/components/ui';
import { color, font } from '@/theme';

export default function DeliveryFailed() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { enqueue } = useQueue();
  const [reason, setReason] = useState('customer_not_available');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await enqueue({ type: 'fail', delivery_id: id!, payload: { reason, ...(note.trim() ? { note: note.trim() } : {}) } });
      router.dismissAll(); // back to today's route
    } finally { setBusy(false); }
  }

  return (
    <Screen footer={<Button title="Submit" variant="dark" onPress={submit} busy={busy} />}>
      <TopBar title="Delivery failed" />
      <Card style={{ gap: 10 }}>
        {FAIL_REASONS.map((r) => <Choice key={r.v} label={r.l} on={reason === r.v} onPress={() => setReason(r.v)} />)}
      </Card>
      <Card>
        <Input label="Notes (optional)" placeholder="Add details" value={note} onChangeText={setNote} maxLength={300} multiline />
      </Card>
      <View>
        <Text style={{ fontFamily: font.body, fontSize: 14.5, color: color.muted, lineHeight: 21 }}>Undelivered bread comes back with you to the bakery.</Text>
      </View>
    </Screen>
  );
}
