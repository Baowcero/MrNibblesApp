import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { color, font } from '@/theme';

const icon = (glyph: string) => ({ focused }: { focused: boolean }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>;

export default function Tabbed() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: color.brand, tabBarInactiveTintColor: color.muted, tabBarLabelStyle: { fontFamily: font.bodyMedium, fontSize: 12 }, tabBarStyle: { backgroundColor: '#fff', borderTopColor: color.line } }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('🍞') }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: icon('🧾') }} />
      <Tabs.Screen name="savings" options={{ title: 'Savings', tabBarIcon: icon('🐷') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
