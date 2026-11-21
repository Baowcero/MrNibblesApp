import { cookies } from 'next/headers';
import { crossSiteBlocked, isSameOrigin } from '@/lib/server/same-origin';
import { API_URL, REFRESH, clearAuthCookies } from '@/lib/server/upstream';

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return crossSiteBlocked();
  const jar = await cookies();
  const refresh = jar.get(REFRESH)?.value;
  if (refresh) {
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: refresh }),
    }).catch(() => undefined);
  }
  clearAuthCookies(jar);
  return Response.json({ ok: true });
}
