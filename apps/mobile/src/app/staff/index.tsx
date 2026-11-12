import { Body, Button, Card, H1, Screen } from '@/components/ui';
import { useSession } from '@/lib/session';

export default function StaffHome() {
  const { signOut } = useSession();
  return (
    <Screen>
      <H1>Staff accounts use the dashboard</H1>
      <Card><Body>Please log in to the Mr Nibbles dashboard in your browser. This app is for customers and distributors.</Body></Card>
      <Button title="Log out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
