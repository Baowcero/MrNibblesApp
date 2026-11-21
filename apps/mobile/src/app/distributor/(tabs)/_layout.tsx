import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/tab-bar';

export default function DistributorTabs() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} icons={{ index: 'list', summary: 'check-circle', profile: 'user' }} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Deliveries' }} />
      <Tabs.Screen name="summary" options={{ title: 'Summary' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
