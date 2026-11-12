import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BricolageGrotesque_700Bold, useFonts as useDisplay } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, useFonts as useBody } from '@expo-google-fonts/dm-sans';
import { SessionProvider, useSession } from '@/lib/session';

void SplashScreen.preventAutoHideAsync();

function Routes() {
  const { user, loading } = useSession();
  const needsPassword = !!user?.must_change_password; // accounts made by staff must choose their own password first
  const isCustomer = !!user?.roles.includes('customer') && !needsPassword;
  const isDistributor = !!user?.roles.includes('distributor') && !needsPassword;
  const isStaff = !!user && !needsPassword && !user.roles.includes('customer') && !user.roles.includes('distributor');
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fbf5ea' } }}>
      <Stack.Protected guard={!loading && !user}><Stack.Screen name="(auth)" /></Stack.Protected>
      <Stack.Protected guard={needsPassword}><Stack.Screen name="set-password" /></Stack.Protected>
      <Stack.Protected guard={isCustomer}><Stack.Screen name="(customer)" /></Stack.Protected>
      <Stack.Protected guard={isDistributor}><Stack.Screen name="distributor" /></Stack.Protected>
      <Stack.Protected guard={isStaff}><Stack.Screen name="staff" /></Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [d] = useDisplay({ BricolageGrotesque_700Bold });
  const [b] = useBody({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const ready = d && b;
  useEffect(() => { if (ready) void SplashScreen.hideAsync(); }, [ready]);
  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <SessionGate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function SessionGate() {
  const { loading } = useSession();
  if (loading) return null;
  return <Routes />;
}
