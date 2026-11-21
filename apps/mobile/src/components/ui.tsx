import { useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { color, font, radius, shadow, tnum } from "@/theme";

export type IconName = ComponentProps<typeof Feather>["name"];
export const Icon = ({
  name,
  size = 20,
  tint = color.navy,
}: {
  name: IconName;
  size?: number;
  tint?: string;
}) => <Feather name={name} size={size} color={tint} />;

/** Page frame. `footer` sticks to the bottom (used for the order total + button). */
export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  padded = true,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  padded?: boolean;
  footer?: ReactNode;
}) {
  const inner = padded
    ? { padding: 20, paddingBottom: 40, gap: 16 }
    : undefined;
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.screen}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={inner}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={color.brand}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
      {footer ? (
        <SafeAreaView edges={["bottom"]} style={s.footer}>
          {footer}
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

/** Navy brand header + cream sheet, the mobile version of the dashboard sign-in. */
export function AuthShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: color.side }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          bounces={false}
        >
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 56,
              overflow: "hidden",
            }}
          >
            <View
              style={[
                s.glow,
                {
                  backgroundColor: color.orange,
                  opacity: 0.18,
                  top: -70,
                  right: -60,
                  width: 220,
                  height: 220,
                },
              ]}
            />
            <View
              style={[
                s.glow,
                {
                  backgroundColor: color.brand,
                  opacity: 0.22,
                  bottom: -90,
                  left: -70,
                  width: 220,
                  height: 220,
                },
              ]}
            />
            <Text
              style={{
                fontFamily: font.display,
                fontSize: 26,
                color: "#fff",
                letterSpacing: -0.5,
              }}
            >
              Mr Nibbles<Text style={{ color: color.orange }}>.</Text>
            </Text>
            <Text
              style={{
                fontFamily: font.display,
                fontSize: 30,
                lineHeight: 36,
                color: "#fff",
                marginTop: 28,
                letterSpacing: -0.6,
              }}
            >
              {title}
            </Text>
            {lead ? (
              <Text
                style={{
                  fontFamily: font.body,
                  fontSize: 15,
                  lineHeight: 22,
                  color: "#c9d5f2",
                  marginTop: 8,
                }}
              >
                {lead}
              </Text>
            ) : null}
          </View>
          <View style={s.sheet}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Back button + title row used on pushed screens. */
export function TopBar({
  title,
  right,
}: {
  title?: string;
  right?: ReactNode;
}) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={s.iconBtn}
      >
        <Icon name="arrow-left" size={20} />
      </Pressable>
      <Text style={[s.topTitle, { flex: 1 }]} numberOfLines={1}>
        {title ?? ""}
      </Text>
      {right}
    </View>
  );
}
export const IconButton = ({
  name,
  label,
  onPress,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={s.iconBtn}
  >
    <Icon name={name} size={20} />
  </Pressable>
);
export function Avatar({
  name,
  size = 44,
}: {
  name?: string | null;
  size?: number;
}) {
  const initials =
    (name ?? "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color.side2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{ fontFamily: font.bold, fontSize: size * 0.36, color: "#fff" }}
      >
        {initials}
      </Text>
    </View>
  );
}

export const H1 = ({ children }: { children: ReactNode }) => (
  <Text style={s.h1} accessibilityRole="header">
    {children}
  </Text>
);
export const H2 = ({ children }: { children: ReactNode }) => (
  <Text style={s.h2} accessibilityRole="header">
    {children}
  </Text>
);
export const Body = ({
  children,
  muted,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) => (
  <Text style={[s.body, muted && { color: color.muted }, style]}>
    {children}
  </Text>
);
export const Money = ({
  children,
  big,
}: {
  children: ReactNode;
  big?: boolean;
}) => <Text style={[s.money, big && { fontSize: 32 }]}>{children}</Text>;
export const SectionHead = ({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    <Text style={s.h2} accessibilityRole="header">
      {title}
    </Text>
    {action ? (
      <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
        <Text
          style={{ fontFamily: font.bold, fontSize: 14, color: color.brand }}
        >
          {action}
        </Text>
      </Pressable>
    ) : null}
  </View>
);

export function Card({
  children,
  style,
  tone,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: "brand" | "orange" | "warn" | "bad" | "dark";
}) {
  const bg =
    tone === "brand"
      ? color.brandSoft
      : tone === "orange"
        ? color.orangeSoft
        : tone === "warn"
          ? color.warnSoft
          : tone === "bad"
            ? color.badSoft
            : tone === "dark"
              ? color.side
              : color.card;
  const border =
    tone === "brand"
      ? "#cbd9fb"
      : tone === "orange"
        ? "#f7d3a8"
        : tone === "warn"
          ? "#f3dca0"
          : tone === "bad"
            ? "#f4c3c3"
            : tone === "dark"
              ? color.side
              : color.line;
  return (
    <View
      style={[
        s.card,
        { backgroundColor: bg, borderColor: border },
        tone ? null : shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Big number with a small label and an icon chip (summary tiles). */
export function StatTile({
  label,
  value,
  sub,
  icon,
  tint = color.brand,
  soft = color.brandSoft,
  style,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: IconName;
  tint?: string;
  soft?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.card, shadow, { padding: 14, gap: 10 }, style]}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          backgroundColor: soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={17} tint={tint} />
      </View>
      <View>
        <Text
          style={[
            {
              fontFamily: font.display,
              fontSize: 26,
              color: color.navy,
              letterSpacing: -0.5,
            },
            tnum,
          ]}
        >
          {value}
        </Text>
        <Text
          style={{ fontFamily: font.semi, fontSize: 12.5, color: color.muted }}
        >
          {label}
        </Text>
        {sub ? (
          <Text
            style={{ fontFamily: font.body, fontSize: 12, color: color.muted }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 8 }}
    >
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.key)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 38,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: on ? color.side2 : "#fff",
              borderWidth: 1,
              borderColor: on ? color.side2 : color.line,
            }}
          >
            <Text
              style={{
                fontFamily: font.semi,
                fontSize: 14,
                color: on ? "#fff" : color.navy,
              }}
            >
              {t.label}
            </Text>
            {t.count !== undefined ? (
              <Text
                style={[
                  {
                    fontFamily: font.bold,
                    fontSize: 12,
                    color: on ? "#c9d5f2" : color.muted,
                  },
                  tnum,
                ]}
              >
                {t.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type Variant = "primary" | "accent" | "dark" | "secondary" | "ghost" | "danger";
export function Button({
  title,
  onPress,
  busy,
  disabled,
  variant = "primary",
  style,
  icon,
  arrow,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  icon?: IconName;
  arrow?: boolean;
}) {
  const off = disabled || busy;
  const bg =
    variant === "primary"
      ? color.brand
      : variant === "accent"
        ? color.orange
        : variant === "dark"
          ? color.side2
          : variant === "danger"
            ? color.bad
            : variant === "secondary"
              ? color.card
              : "transparent";
  const fg =
    variant === "secondary"
      ? color.navy
      : variant === "ghost"
        ? color.brand
        : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        variant === "secondary" && { borderWidth: 1, borderColor: color.line },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon ? <Icon name={icon} size={18} tint={fg} /> : null}
          <Text style={[s.btnText, { color: fg }]}>{title}</Text>
          {arrow ? <Icon name="arrow-right" size={18} tint={fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

export function Input({
  label,
  error,
  style,
  icon,
  secureTextEntry,
  ...rest
}: TextInputProps & { label: string; error?: string | null; icon?: IconName }) {
  const [hidden, setHidden] = useState(true);
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <View
        style={[
          s.inputWrap,
          focus && { borderColor: color.brand },
          error ? { borderColor: color.bad } : null,
        ]}
      >
        {icon ? <Icon name={icon} size={18} tint={color.muted} /> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#9aa3b5"
          secureTextEntry={secureTextEntry && hidden}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={[s.input, style]}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
          >
            <Icon
              name={hidden ? "eye" : "eye-off"}
              size={18}
              tint={color.muted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={{ color: color.bad, fontFamily: font.body, fontSize: 13 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Selectable card/pill used for choices (delivery vs pickup, area, reason...). */
export function Choice({
  label,
  sub,
  on,
  onPress,
  icon,
  style,
}: {
  label: string;
  sub?: string;
  on: boolean;
  onPress: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[
        {
          padding: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: on ? color.brand : color.line,
          backgroundColor: on ? color.brandSoft : "#fff",
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        style,
      ]}
    >
      {icon ? (
        <Icon name={icon} size={20} tint={on ? color.brand : color.muted} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: font.bold, fontSize: 15, color: color.navy }}
        >
          {label}
        </Text>
        {sub ? (
          <Text
            style={{
              fontFamily: font.body,
              fontSize: 12.5,
              color: color.muted,
              marginTop: 1,
            }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: on ? color.brand : color.line,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {on ? (
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: color.brand,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

type Tone = "ok" | "warn" | "bad" | "brand" | "orange" | "neutral";
const TONES: Record<Tone, [string, string]> = {
  ok: [color.okSoft, color.ok],
  warn: [color.warnSoft, color.warn],
  bad: [color.badSoft, color.bad],
  brand: [color.brandSoft, color.brand],
  orange: [color.orangeSoft, "#b85f08"],
  neutral: [color.cream2, color.navy],
};
export function Badge({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: Tone;
}) {
  const [bg, fg] = TONES[tone];
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <View
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }}
      />
      <Text style={[s.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  placed: { label: "Waiting for payment", tone: "warn" },
  paid: { label: "Paid", tone: "brand" },
  assigned: { label: "Assigned", tone: "brand" },
  out_for_delivery: { label: "Out for delivery", tone: "orange" },
  delivered: { label: "Delivered", tone: "ok" },
  ready: { label: "Ready for pickup", tone: "orange" },
  collected: { label: "Collected", tone: "ok" },
  delivery_failed: { label: "Delivery failed", tone: "bad" },
};

export const ErrorNote = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <Card tone="bad">
    <Body>{message}</Body>
    {onRetry ? (
      <Button
        title="Try again"
        variant="secondary"
        onPress={onRetry}
        style={{ marginTop: 12 }}
      />
    ) : null}
  </Card>
);
export const Loading = () => (
  <View style={{ padding: 40 }}>
    <ActivityIndicator color={color.brand} size="large" />
  </View>
);
export const Row = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) => (
  <View
    style={[
      {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      },
      style,
    ]}
  >
    {children}
  </View>
);
export const Divider = () => (
  <View style={{ height: 1, backgroundColor: color.line }} />
);

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.cream },
  footer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: color.line,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  glow: { position: "absolute", borderRadius: 999 },
  sheet: {
    flex: 1,
    backgroundColor: color.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: color.line,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontFamily: font.display,
    fontSize: 22,
    color: color.navy,
    letterSpacing: -0.4,
  },
  h1: {
    fontFamily: font.display,
    fontSize: 28,
    color: color.navy,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: font.bold,
    fontSize: 18,
    color: color.navy,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: font.body,
    fontSize: 15.5,
    color: color.navy,
    lineHeight: 22,
  },
  money: { fontFamily: font.display, fontSize: 20, color: color.navy, ...tnum },
  card: { borderRadius: radius.card, padding: 18, borderWidth: 1 },
  btn: {
    minHeight: 52,
    borderRadius: radius.button,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontFamily: font.bold, fontSize: 16 },
  label: { fontFamily: font.semi, fontSize: 13.5, color: color.navy },
  inputWrap: {
    minHeight: 52,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 50,
    fontFamily: font.body,
    fontSize: 16,
    color: color.navy,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { fontFamily: font.bold, fontSize: 12 },
});
