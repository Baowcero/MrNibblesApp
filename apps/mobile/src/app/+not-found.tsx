import { Redirect } from 'expo-router';
import { useSession } from '@/lib/session';

/**
 * When the app lands on a screen that is not open to the current person (right after logging out, for example)
 * send them to the right home instead of the developer sitemap.
 */
export default function NotFound() {
  const { user, loading } = useSession();
  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.must_change_password) return <Redirect href="/set-password" />;
  if (user.roles.includes('customer')) return <Redirect href="/" />;
  if (user.roles.includes('distributor')) return <Redirect href="/distributor" />;
  return <Redirect href="/staff" />;
}
