import { cookies } from 'next/headers';
import { API_URL, clearAuthCookies, setAuthCookies, type Tokens } from '@/lib/server/upstream';

const STAFF = ['ceo', 'sales', 'accounts', 'production', 'store_keeper'];

export async function POST(req: Request) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '' },
      body: await req.text(),
      cache: 'no-store',
    });
  } catch {
    return Response.json({ error: { code: 'api_unreachable', message: 'Cannot reach the server. Check your connection.' } }, { status: 502 });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) return Response.json(data ?? { error: { code: 'server_error', message: 'Something went wrong' } }, { status: res.status });

  const user = data.user as { roles: string[] };
  if (!user.roles.some((r) => STAFF.includes(r))) {
    // Customers and distributors use the mobile app. End the session we just opened.
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: data.refresh_token }),
    }).catch(() => undefined);
    return Response.json({ error: { code: 'not_staff', message: 'This dashboard is for Mr Nibbles staff. Please use the mobile app.' } }, { status: 403 });
  }

  const jar = await cookies();
  clearAuthCookies(jar);
  setAuthCookies(jar, data as Tokens);
  return Response.json({ user: data.user });
}
