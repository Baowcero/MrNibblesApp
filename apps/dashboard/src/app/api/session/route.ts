import { callApi } from '@/lib/server/upstream';

/** Who is logged in. The page uses this to pick the menu and to force a first-time password change. */
export async function GET() {
  const res = await callApi('/v1/me');
  return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json' } });
}
