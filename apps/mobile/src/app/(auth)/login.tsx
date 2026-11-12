import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Body, Button, ErrorNote, H1, Input, Screen } from '@/components/ui';
import { color, font } from '@/theme';

export default function Login() {
  const { signIn } = useSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try { await signIn(phone.trim(), password); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: 16, paddingTop: 24 }}>
        <Text style={{ fontFamily: font.display, fontSize: 40, color: color.brand }}>Mr Nibbles</Text>
        <H1>Welcome back</H1>
        <Body muted>Log in with your phone number to order fresh bread.</Body>
        {error ? <ErrorNote message={error} /> : null}
        <Input label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="0803 000 0000" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
        <Button title="Log in" onPress={submit} busy={busy} disabled={!phone.trim() || !password} />
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Body muted>New here?</Body>
          <Link href="/signup" style={{ fontFamily: font.bodyBold, fontSize: 16, color: color.brand, padding: 8 }}>Create an account</Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
