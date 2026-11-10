import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { callApi, setAuthCookies, type Tokens } from '@/lib/server/upstream';

/** Forwards /api/proxy/<path> to the API at /v1/<path> with the user's token. The browser never sees the tokens. */
async function handle(req: NextRequest, ctx: RouteContext<'/api/proxy/[...path]'>) {
  const { path } = await ctx.params;
  const joined = path.join('/');
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
  const hasBody = !!body && body.byteLength > 0;

  const headers: Record<string, string> = {};
  const ct = req.headers.get('content-type');
  if (hasBody && ct) headers['content-type'] = ct;
  const idem = req.headers.get('idempotency-key');
  if (idem) headers['idempotency-key'] = idem;

  const res = await callApi(`/v1/${joined}${req.nextUrl.search}`, { method: req.method, body: hasBody ? body : undefined, headers });

  // Changing the password returns fresh tokens: keep them in the cookies, not in the page.
  if ((joined === 'auth/set-password' || joined === 'auth/change-password') && res.ok) {
    const data = await res.json();
    setAuthCookies(await cookies(), data as Tokens);
    return Response.json({ user: data.user });
  }

  const out = new Headers();
  for (const h of ['content-type', 'content-disposition']) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  out.set('cache-control', 'private, no-store');
  return new Response(res.status === 204 ? null : res.body, { status: res.status, headers: out });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
