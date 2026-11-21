import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { formatDateTime } from '@/lib/format';
import { Body, Card, ErrorNote, H1, Icon, Loading, Screen, TopBar, type IconName } from '@/components/ui';
import { color, font } from '@/theme';

interface N { id: string; type: string; title: string; body: string; target: string | null; read: boolean; created_at: string }
const ICON: Record<string, [IconName, string, string]> = {
  order_status: ['shopping-bag', color.brand, color.brandSoft], account_update: ['user-check', color.ok, color.okSoft], issue_update: ['alert-circle', '#b85f08', color.orangeSoft],
};

export default function Notifications() {
  const router = useRouter();
  const q = useQuery<{ data: N[]; unread: number }>('notifications');
  const [seen, setSeen] = useState<Set<string>>(new Set()); // shown as read straight away

  function open(n: N) {
    if (!n.read && !seen.has(n.id)) {
      setSeen((s) => new Set(s).add(n.id));
      void api(`notifications/${n.id}/read`, { method: 'POST', body: {} }).catch(() => undefined);
    }
    const [kind, id] = n.target?.split(':') ?? [];
    if (kind === 'order' && id) router.push({ pathname: '/order/[id]', params: { id } });
  }

  return (
    <Screen onRefresh={q.reload} refreshing={q.loading && !!q.data}>
      <TopBar />
      <H1>Notifications</H1>
      {q.error ? <ErrorNote message={q.error} onRetry={q.reload} /> : !q.data ? <Loading /> : q.data.data.length === 0 ? <Card><Body muted>Nothing here yet.</Body></Card> : q.data.data.map((n) => {
        const [name, fg, bg] = ICON[n.type] ?? ['bell', color.brand, color.brandSoft];
        const unread = !n.read && !seen.has(n.id);
        return (
          <Pressable key={n.id} accessibilityRole="button" onPress={() => open(n)}>
            <Card style={{ flexDirection: 'row', gap: 12, ...(unread ? { borderColor: color.orange } : null) }}>
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={name} size={18} tint={fg} /></View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: unread ? font.bold : font.semi, fontSize: 15.5, color: color.navy }}>{n.title}</Text>
                <Body>{n.body}</Body>
                <Body muted style={{ fontSize: 13 }}>{formatDateTime(n.created_at)}</Body>
              </View>
              {unread && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color.orange, marginTop: 6 }} />}
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
