import { Stack } from 'expo-router';
import { DayProvider } from '@/lib/deliveries';
import { QueueProvider } from '@/lib/queue';
import { color } from '@/theme';

export default function DistributorLayout() {
  return (
    <QueueProvider>
      <DayProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.cream } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="delivery/[id]/index" />
        <Stack.Screen name="delivery/[id]/failed" />
        <Stack.Screen name="report" />
      </Stack>
      </DayProvider>
    </QueueProvider>
  );
}
