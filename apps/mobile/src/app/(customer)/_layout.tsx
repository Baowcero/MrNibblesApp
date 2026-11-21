import { Stack } from 'expo-router';
import { color } from '@/theme';

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.cream } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="new-order" />
      <Stack.Screen name="review" />
      <Stack.Screen name="order/[id]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="payment-confirmed" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
