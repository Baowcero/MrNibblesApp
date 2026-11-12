import { Stack } from 'expo-router';
import { color } from '@/theme';

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.cream } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="new-order" options={{ presentation: 'modal' }} />
      <Stack.Screen name="order/[id]" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
