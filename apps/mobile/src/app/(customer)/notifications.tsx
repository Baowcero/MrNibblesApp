import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@/lib/use-query';
import { formatDateTime } from '@/lib/format';
import { Body, Button, Card, ErrorNote, H1, Loading, Screen } from '@/components/ui';
import { color, font } from '@/theme';

interface N { id: string; type: string; title: string; body: string; created_at: string }

export default function Notifications() {
  const router = useRouter();
  const q = useQuery<{ data: N[] }>('notifications');
  return (
    <Screen onRefresh={q.reload} refreshing={q.loading && !!q.data}>
      <Button title="Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
      <H1>Notifications</H1>
      {q.error ? <ErrorNote message={q.error} onRetry={q.reload} /> : !q.data ? <Loading /> : q.data.data.length === 0 ? <Card><Body muted>Nothing here yet.</Body></Card> : q.data.data.map((n) => (
        <Card key={n.id}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: font.bodyBold, fontSize: 16, color: color.navy }}>{n.title}</Text>
            <Body>{n.body}</Body>
            <Body muted>{formatDateTime(n.created_at)}</Body>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
