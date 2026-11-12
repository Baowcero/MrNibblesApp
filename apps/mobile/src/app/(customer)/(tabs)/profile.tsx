import { useState } from 'react';
import { Alert, View } from 'react-native';
import { api, errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Body, Button, Card, ErrorNote, H1, H2, Input, Screen } from '@/components/ui';

export default function Profile() {
  const { user, signOut, reload } = useSession();
  const [email, setEmail] = useState(user?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  async function saveEmail() {
    setBusy(true);
    setMsg(null);
    try { await api('me', { method: 'PATCH', body: { email: email.trim() } }); await reload(); setMsg({ text: 'Email saved. Payment receipts will go there.' }); }
    catch (e) { setMsg({ text: errorText(e), bad: true }); } finally { setBusy(false); }
  }

  return (
    <Screen>
      <H1>Profile</H1>
      <Card style={{ gap: 4 }}>
        <H2>{user?.customer?.business_name}</H2>
        <Body muted>{user?.full_name}</Body>
        <Body muted>{user?.phone}</Body>
        {(user?.locations ?? []).map((l) => <Body key={l.id} muted>{l.address}, {l.area.name}</Body>)}
      </Card>
      <Card style={{ gap: 12 }}>
        <H2>Email for receipts</H2>
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        {msg ? (msg.bad ? <ErrorNote message={msg.text} /> : <Body>{msg.text}</Body>) : null}
        <Button title="Save email" onPress={saveEmail} busy={busy} disabled={email.trim() === (user?.email ?? '')} />
      </Card>
      <View style={{ marginTop: 8 }}>
        <Button title="Log out" variant="secondary" onPress={() => Alert.alert('Log out?', 'You will need your password to log in again.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: () => void signOut() }])} />
      </View>
    </Screen>
  );
}
