import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { api, errorText } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Body, Button, Card, ErrorNote, H1, Input, Screen } from '@/components/ui';
import { color, font } from '@/theme';

interface Biz { id: string; business_name: string }
interface Area { id: string; name: string }

export default function Signup() {
  const { signUp } = useSession();
  const [areas, setAreas] = useState<Area[]>([]);
  const [find, setFind] = useState('');
  const [matches, setMatches] = useState<Biz[]>([]);
  const [claim, setClaim] = useState<Biz | null>(null);
  const [newName, setNewName] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [areaId, setAreaId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void api<{ data: Area[] }>('areas', { auth: false }).then((r) => setAreas(r.data)).catch(() => undefined); }, []);
  useEffect(() => {
    if (claim || find.trim().length < 2) { setMatches([]); return; }
    const t = setTimeout(() => { void api<{ data: Biz[] }>(`auth/signup/businesses?q=${encodeURIComponent(find.trim())}`, { auth: false }).then((r) => setMatches(r.data)).catch(() => undefined); }, 300);
    return () => clearTimeout(t);
  }, [find, claim]);

  const businessOk = claim || newName.trim().length >= 2;
  const ready = businessOk && fullName.trim().length >= 2 && phone.trim() && password.length >= 8 && address.trim().length >= 5 && areaId;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signUp({
        full_name: fullName.trim(), phone: phone.trim(), password, address: address.trim(), area_id: areaId,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(claim ? { claim_customer_id: claim.id } : { business_name: newName.trim() }),
      });
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  return (
    <Screen>
      <H1>Create your account</H1>
      <Body muted>Our team approves new accounts before you can order. You will be notified.</Body>
      {error ? <ErrorNote message={error} /> : null}

      <Card>
        <Text style={{ fontFamily: font.display, fontSize: 18, color: color.navy, marginBottom: 12 }}>Your business</Text>
        {claim ? (
          <View style={{ gap: 8 }}>
            <Body>{claim.business_name}</Body>
            <Button title="Choose a different business" variant="ghost" onPress={() => { setClaim(null); setFind(''); }} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Input label="Find your business" value={find} onChangeText={setFind} placeholder="Start typing your business name" />
            {matches.map((m) => (
              <Pressable key={m.id} accessibilityRole="button" onPress={() => setClaim(m)} style={{ padding: 14, borderRadius: 16, backgroundColor: color.cream2 }}>
                <Text style={{ fontFamily: font.bodyBold, fontSize: 16, color: color.navy }}>{m.business_name}</Text>
              </Pressable>
            ))}
            <Body muted>Not in the list? Enter the name below and we will add it.</Body>
            <Input label="Business name" value={newName} onChangeText={setNewName} />
          </View>
        )}
      </Card>

      <Input label="Your full name" value={fullName} onChangeText={setFullName} autoComplete="name" />
      <Input label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="0803 000 0000" />
      <Input label="Email (optional, for payment receipts)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={password && password.length < 8 ? 'At least 8 characters with a letter and a number' : null} />
      <Input label="Delivery address" value={address} onChangeText={setAddress} placeholder="Street and landmark" />

      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: font.bodyMedium, fontSize: 14, color: color.navy }}>Area</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {areas.map((a) => (
            <Pressable key={a.id} accessibilityRole="radio" accessibilityState={{ selected: areaId === a.id }} onPress={() => setAreaId(a.id)}
              style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: areaId === a.id ? color.navy : '#fff', borderWidth: 1, borderColor: color.line }}>
              <Text style={{ fontFamily: font.bodyMedium, color: areaId === a.id ? '#fff' : color.navy }}>{a.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Button title="Create account" onPress={submit} busy={busy} disabled={!ready} />
      <View style={{ alignItems: 'center' }}><Link href="/login" style={{ fontFamily: font.bodyBold, color: color.brand, padding: 8 }}>I already have an account</Link></View>
    </Screen>
  );
}
