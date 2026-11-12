import { useState } from 'react';
import { Alert } from 'react-native';
import { errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Body, Button, Card, ErrorNote, H1, Input, Screen } from '@/components/ui';

const RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

export default function SetPassword() {
  const { user, setPassword, signOut } = useSession();
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weak = pw.length > 0 && !RULE.test(pw);
  const mismatch = again.length > 0 && again !== pw;

  async function submit() {
    setBusy(true);
    setError(null);
    try { await setPassword(pw); } catch (e) { setError(errorText(e)); setBusy(false); }
  }

  return (
    <Screen>
      <H1>Choose your password</H1>
      <Body muted>Hello{user ? `, ${user.full_name.split(' ')[0]}` : ''}. The password you were given was only temporary. Please choose your own to continue.</Body>
      {error ? <ErrorNote message={error} /> : null}
      <Card style={{ gap: 14 }}>
        <Input label="New password" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={weak ? 'At least 8 characters, with a letter and a number' : null} />
        <Input label="Type it again" value={again} onChangeText={setAgain} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={submit} error={mismatch ? 'The two passwords do not match' : null} />
        <Button title="Save and continue" onPress={submit} busy={busy} disabled={!RULE.test(pw) || pw !== again} />
      </Card>
      <Button title="Log out" variant="ghost" onPress={() => Alert.alert('Log out?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', onPress: () => void signOut() }])} />
    </Screen>
  );
}
