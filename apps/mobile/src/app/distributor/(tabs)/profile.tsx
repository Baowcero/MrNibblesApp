import { Alert, Text, View } from 'react-native';
import { useDeliveries } from '@/lib/deliveries';
import { useSession } from '@/lib/session';
import { Avatar, Badge, Button, Card, Divider, Icon, Screen, SectionHead, type IconName } from '@/components/ui';
import { color, font } from '@/theme';

function Info({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: color.cream2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={17} tint={color.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.semi, fontSize: 12.5, color: color.muted }}>{label}</Text>
        <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: value ? color.navy : '#9aa3b5' }} numberOfLines={1}>{value || 'Not added'}</Text>
      </View>
    </View>
  );
}

export default function DistributorProfile() {
  const { user, signOut } = useSession();
  const { queue, syncing, flush } = useDeliveries();

  return (
    <Screen>
      <Card tone="dark" style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={user?.full_name} size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: font.display, fontSize: 22, color: '#fff', letterSpacing: -0.4 }} numberOfLines={1}>{user?.full_name}</Text>
            <View style={{ alignSelf: 'flex-start' }}><Badge text="Distributor" tone="orange" /></View>
          </View>
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionHead title="Your details" />
        <Info icon="user" label="Name" value={user?.full_name ?? ''} />
        <Divider />
        <Info icon="phone" label="Phone" value={user?.phone ?? ''} />
        <Text style={{ fontFamily: font.body, fontSize: 13, color: color.muted }}>To change these, ask the bakery.</Text>
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionHead title="Updates" />
        <Text style={{ fontFamily: font.body, fontSize: 14.5, color: color.muted }}>
          {queue.length === 0 ? 'All your updates have been sent.' : syncing ? 'Sending your updates…' : `${queue.length} update${queue.length === 1 ? '' : 's'} waiting to be sent.`}
        </Text>
        {queue.length > 0 && !syncing && <Button title="Send now" variant="secondary" icon="upload-cloud" onPress={() => void flush()} />}
      </Card>

      <Button
        title="Log out"
        variant="secondary"
        icon="log-out"
        onPress={() => Alert.alert('Log out?', queue.length ? `${queue.length} update(s) have not been sent yet. They will wait until you log in again.` : 'You will need your password to log in again.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
        ])}
      />
    </Screen>
  );
}
