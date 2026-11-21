import { useState } from "react";
import { Text, View } from "react-native";
import { Link } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { errorText } from "@/lib/api";
import { useSession } from "@/lib/session";
import { AuthShell, Button, ErrorNote, Input } from "@/components/ui";
import { color, font } from "@/theme";

export default function Login() {
  const { signIn } = useSession();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(phone.trim(), password);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="A little care. Fresh bread, every morning."
      lead="Order your bread before 8:30 AM and we bring it to your door."
    >
      <StatusBar style="light" />
      <View style={{ gap: 4 }}>
        <Text
          style={{
            fontFamily: font.display,
            fontSize: 26,
            color: color.navy,
            letterSpacing: -0.5,
          }}
        >
          Welcome back.
        </Text>
        <Text
          style={{ fontFamily: font.body, fontSize: 15, color: color.muted }}
        >
          Log in with your phone number.
        </Text>
      </View>
      {error ? <ErrorNote message={error} /> : null}
      <Input
        label="Phone number"
        icon="phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder="0803 000 0000"
      />
      <Input
        label="Password"
        icon="lock"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
      />
      <Button
        title="Log in"
        variant="accent"
        arrow
        onPress={submit}
        busy={busy}
        disabled={!phone.trim() || !password}
      />
      <View
        style={{
          alignItems: "center",
          marginTop: 8,
          flexDirection: "row",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Text
          style={{ fontFamily: font.body, fontSize: 15, color: color.muted }}
        >
          New here?
        </Text>
        <Link
          href="/signup"
          style={{
            fontFamily: font.bold,
            fontSize: 15,
            color: color.brand,
            padding: 6,
          }}
        >
          Create an account
        </Link>
      </View>
    </AuthShell>
  );
}
