import { Stack } from 'expo-router';
import { QueueProvider } from '@/lib/queue';
import { color } from '@/theme';

export default function DistributorLayout() {
  return (
    <QueueProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.cream } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="delivery/[id]" />
      </Stack>
    </QueueProvider>
  );
}
