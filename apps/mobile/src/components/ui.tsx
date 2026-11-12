import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, font, radius, shadow } from '@/theme';

export function Screen({ children, scroll = true, onRefresh, refreshing = false, padded = true }: { children: ReactNode; scroll?: boolean; onRefresh?: () => void; refreshing?: boolean; padded?: boolean }) {
  const inner = padded ? { padding: 20, paddingBottom: 40, gap: 16 } : undefined;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.screen}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.brand} /> : undefined}>{children}</ScrollView>
      ) : <View style={[{ flex: 1 }, inner]}>{children}</View>}
    </SafeAreaView>
  );
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1} accessibilityRole="header">{children}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2} accessibilityRole="header">{children}</Text>;
export const Body = ({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) => <Text style={[s.body, muted && { color: color.muted }, style]}>{children}</Text>;
export const Money = ({ children, big }: { children: ReactNode; big?: boolean }) => <Text style={[s.money, big && { fontSize: 32 }]}>{children}</Text>;

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'brand' | 'orange' | 'warn' | 'bad' }) {
  const bg = tone === 'brand' ? color.brandSoft : tone === 'orange' ? color.orangeSoft : tone === 'warn' ? color.warnSoft : tone === 'bad' ? color.badSoft : color.card;
  return <View style={[s.card, { backgroundColor: bg }, style]}>{children}</View>;
}

export function Button({ title, onPress, busy, disabled, variant = 'primary', style }: { title: string; onPress: () => void; busy?: boolean; disabled?: boolean; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; style?: StyleProp<ViewStyle> }) {
  const off = disabled || busy;
  const bg = variant === 'primary' ? color.brand : variant === 'danger' ? color.bad : variant === 'secondary' ? color.card : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? '#fff' : variant === 'ghost' ? color.brand : color.navy;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!busy }} disabled={off} onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 }, variant === 'secondary' && { borderWidth: 1, borderColor: color.line }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Input({ label, error, style, ...rest }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor="#9ca3af" style={[s.input, error ? { borderColor: color.bad } : null, style]} {...rest} />
      {error ? <Text style={{ color: color.bad, fontFamily: font.body, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

type Tone = 'ok' | 'warn' | 'bad' | 'brand' | 'orange' | 'neutral';
const TONES: Record<Tone, [string, string]> = { ok: [color.okSoft, color.ok], warn: [color.warnSoft, color.warn], bad: [color.badSoft, color.bad], brand: [color.brandSoft, color.brand], orange: [color.orangeSoft, color.orange], neutral: [color.cream2, color.navy] };
export function Badge({ text, tone = 'neutral' }: { text: string; tone?: Tone }) {
  const [bg, fg] = TONES[tone];
  return <View style={[s.badge, { backgroundColor: bg }]}><Text style={[s.badgeText, { color: fg }]}>{text}</Text></View>;
}

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  placed: { label: 'Waiting for payment', tone: 'warn' }, paid: { label: 'Paid', tone: 'brand' }, assigned: { label: 'Preparing', tone: 'brand' },
  out_for_delivery: { label: 'Out for delivery', tone: 'orange' }, delivered: { label: 'Delivered', tone: 'ok' }, ready: { label: 'Ready for pickup', tone: 'orange' },
  collected: { label: 'Collected', tone: 'ok' }, delivery_failed: { label: 'Delivery failed', tone: 'bad' },
};

export const ErrorNote = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <Card tone="bad"><Body>{message}</Body>{onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} style={{ marginTop: 12 }} /> : null}</Card>
);
export const Loading = () => <View style={{ padding: 40 }}><ActivityIndicator color={color.brand} size="large" /></View>;
export const Row = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, style]}>{children}</View>;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.cream },
  h1: { fontFamily: font.display, fontSize: 30, color: color.navy, lineHeight: 36 },
  h2: { fontFamily: font.display, fontSize: 20, color: color.navy },
  body: { fontFamily: font.body, fontSize: 16, color: color.navy, lineHeight: 22 },
  money: { fontFamily: font.display, fontSize: 20, color: color.navy },
  card: { borderRadius: radius.card, padding: 18, ...shadow },
  btn: { minHeight: 52, borderRadius: radius.pill, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: font.bodyBold, fontSize: 16 },
  label: { fontFamily: font.bodyMedium, fontSize: 14, color: color.navy },
  input: { minHeight: 52, borderRadius: radius.input, borderWidth: 1, borderColor: color.line, backgroundColor: '#fff', paddingHorizontal: 16, fontFamily: font.body, fontSize: 16, color: color.navy },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontFamily: font.bodyBold, fontSize: 12 },
});
