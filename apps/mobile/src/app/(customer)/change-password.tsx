import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Body, Button, Card, ErrorNote, H1, Icon, Input, Screen, TopBar } from '@/components/ui';
import { color, font } from '@/theme';

const RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

export default function ChangePassword() {
  const router = useRouter();
  const { changePassword } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const weak = next.length > 0 && !RULE.test(next);
  const mismatch = again.length > 0 && again !== next;
  const ready = current.length > 0 && RULE.test(next) && next === again && next !== current;

  async function save() {
    setBusy(true); setError(null);
    try { await changePassword(current, next); setDone(true); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <Screen footer={<Button title="Done" variant="dark" onPress={() => router.back()} />}>
        <TopBar />
        <View style={{ alignItems: 'center', gap: 12, paddingTop: 40 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: color.okSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={40} tint={color.ok} /></View>
          <Text style={{ fontFamily: font.display, fontSize: 26, color: color.navy, letterSpacing: -0.5 }}>Password changed</Text>
          <Body muted style={{ textAlign: 'center' }}>Use your new password next time you log in. Any other phone signed in to your account has been logged out.</Body>
        </View>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title="Change password" variant="dark" onPress={save} busy={busy} disabled={!ready} />}>
      <TopBar />
      <H1>Change password</H1>
      {error ? <ErrorNote message={error} /> : null}
      <Input label="Current password" icon="lock" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" />
      <Input label="New password" icon="lock" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={weak ? 'At least 8 characters, with a letter and a number' : null} />
      <Input label="Type the new password again" icon="lock" value={again} onChangeText={setAgain} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={mismatch ? 'The two passwords do not match' : null} />
      <Card style={{ padding: 16 }}><Body muted style={{ fontSize: 14 }}>Pick something you do not use anywhere else. Changing it logs out any other phone signed in to your account.</Body></Card>
    </Screen>
  );
}
