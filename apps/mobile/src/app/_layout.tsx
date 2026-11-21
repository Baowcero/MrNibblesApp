import { useEffect, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/figtree";
import { SessionProvider, useSession } from "@/lib/session";
import { AnimatedSplash } from "@/components/splash";
import { color } from "@/theme";

void SplashScreen.preventAutoHideAsync();

function Routes() {
  const { user, loading } = useSession();
  const router = useRouter();
  const wasIn = useRef(false);
  // After logging out the signed-in screens disappear; send the person to the login screen explicitly.
  useEffect(() => {
    if (user) {
      wasIn.current = true;
      return;
    }
    if (wasIn.current && !loading) {
      wasIn.current = false;
      const t = setTimeout(() => router.replace("/login"), 0);
      return () => clearTimeout(t);
    }
  }, [user, loading, router]);
  const needsPassword = !!user?.must_change_password; // accounts made by staff must choose their own password first
  const isCustomer = !!user?.roles.includes("customer") && !needsPassword;
  const isDistributor = !!user?.roles.includes("distributor") && !needsPassword;
  const isStaff =
    !!user &&
    !needsPassword &&
    !user.roles.includes("customer") &&
    !user.roles.includes("distributor");
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.cream },
      }}
    >
      <Stack.Protected guard={!loading && !user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={needsPassword}>
        <Stack.Screen name="set-password" />
      </Stack.Protected>
      <Stack.Protected guard={isCustomer}>
        <Stack.Screen name="(customer)" />
      </Stack.Protected>
      <Stack.Protected guard={isDistributor}>
        <Stack.Screen name="distributor" />
      </Stack.Protected>
      <Stack.Protected guard={isStaff}>
        <Stack.Screen name="staff" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [ready] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <SplashHost />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

// The branded splash covers the app until the saved session has been read, so the person never sees a blank frame or a login flash.
function SplashHost() {
  const { loading } = useSession();
  return (
    <AnimatedSplash ready={!loading}>
      {loading ? null : <Routes />}
    </AnimatedSplash>
  );
}
