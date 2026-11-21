import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { api, errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Body, Button, Card, ErrorNote, H1, Icon, Input, Screen, TopBar } from '@/components/ui';
import { color, font } from '@/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EditProfile() {
  const router = useRouter();
  const { user, reload } = useSession();
  const [name, setName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOk = name.trim().length >= 2;
  const emailOk = email.trim() === '' || EMAIL.test(email.trim());
  const changed = name.trim() !== (user?.full_name ?? '') || email.trim().toLowerCase() !== (user?.email ?? '');

  async function save() {
    setBusy(true); setError(null);
    try {
      await api('me', { method: 'PATCH', body: { full_name: name.trim(), email: email.trim() } });
      await reload();
      router.back();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  return (
    <Screen footer={<Button title="Save changes" variant="dark" onPress={save} busy={busy} disabled={!changed || !nameOk || !emailOk} />}>
      <TopBar />
      <H1>Edit details</H1>
      {error ? <ErrorNote message={error} /> : null}
      <Input label="Full name" icon="user" value={name} onChangeText={setName} autoComplete="name" error={name.length > 0 && !nameOk ? 'Enter your full name' : null} />
      <Input label="Email for receipts" icon="mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="Optional" error={!emailOk ? 'That email does not look right' : null} />
      <Card tone="brand" style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
        <Icon name="lock" size={18} tint={color.brand} />
        <Body style={{ flex: 1, fontSize: 14.5 }}>
          <Text style={{ fontFamily: font.bold }}>{user?.phone}</Text> is your login, so it cannot be changed here. To change your phone number or business name, please call the bakery.
        </Body>
      </Card>
    </Screen>
  );
}
