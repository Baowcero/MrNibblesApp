import { cookies } from 'next/headers';

export const API_URL = process.env.API_URL ?? 'http://localhost:4000';
export const ACCESS = 'mn_access';
export const REFRESH = 'mn_refresh';

export type Tokens = { access_token: string; refresh_token: string; expires_in: number };
type Jar = Awaited<ReturnType<typeof cookies>>;

const secure = process.env.NODE_ENV === 'production';

export function setAuthCookies(jar: Jar, t: Tokens) {
  const base = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/' };
  jar.set(ACCESS, t.access_token, { ...base, maxAge: Math.max(60, t.expires_in - 30) });
  jar.set(REFRESH, t.refresh_token, { ...base, maxAge: 30 * 86_400 });
}

export function clearAuthCookies(jar: Jar) {
  jar.delete(ACCESS);
  jar.delete(REFRESH);
}

// Several requests can find the access token expired at the same moment. They share one refresh, because the
// API rotates refresh tokens and a second refresh with the old token would look like theft and sign everyone out.
const inflight = new Map<string, Promise<Tokens | null>>();

async function refreshTokens(refresh: string): Promise<Tokens | null> {
  let p = inflight.get(refresh);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
          cache: 'no-store',
        });
        return res.ok ? ((await res.json()) as Tokens) : null;
      } catch {
        return null;
      }
    })().finally(() => setTimeout(() => inflight.delete(refresh), 15_000));
    inflight.set(refresh, p);
  }
  return p;
}

const unauthorized = () =>
  Response.json({ error: { code: 'unauthenticated', message: 'Please log in again' } }, { status: 401 });

/** Calls the API as the logged-in user: adds the token, and refreshes it once if it has expired. */
export async function callApi(
  path: string,
  init: { method?: string; body?: BodyInit | null; headers?: Record<string, string> } = {},
): Promise<Response> {
  const jar = await cookies();
  const refresh = jar.get(REFRESH)?.value;
  let access = jar.get(ACCESS)?.value;

  const refreshNow = async () => {
    if (!refresh) return null;
    const t = await refreshTokens(refresh);
    if (t) {
      setAuthCookies(jar, t);
      return t.access_token;
    }
    clearAuthCookies(jar);
    return null;
  };

  const send = (token: string) =>
    fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: { ...init.headers, authorization: `Bearer ${token}` },
      body: init.body ?? undefined,
      cache: 'no-store',
    });

  try {
    if (!access) access = (await refreshNow()) ?? undefined;
    if (!access) return unauthorized();
    let res = await send(access);
    if (res.status === 401) {
      const fresh = await refreshNow();
      if (!fresh) return unauthorized();
      res = await send(fresh);
    }
    return res;
  } catch {
    return Response.json({ error: { code: 'api_unreachable', message: 'Cannot reach the server. Check your connection.' } }, { status: 502 });
  }
}
