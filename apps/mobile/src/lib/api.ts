import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// A real phone cannot reach "localhost" on your computer. Set EXPO_PUBLIC_API_URL to your computer's LAN address, e.g. http://192.168.1.20:4000
const DEFAULT_URL = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_URL).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error && /network|fetch|failed/i.test(e.message) ? 'Cannot reach the server. Check your connection.' : 'Something went wrong. Please try again.');

// ---- token storage (SecureStore on phones, localStorage on web)
const KEY = 'mn_tokens';
interface Tokens { access: string; refresh: string }
let memory: Tokens | null = null;
let loaded = false;
const web = Platform.OS === 'web';

export async function loadTokens(): Promise<Tokens | null> {
  if (loaded) return memory;
  try {
    const raw = web ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    memory = raw ? (JSON.parse(raw) as Tokens) : null;
  } catch { memory = null; }
  loaded = true;
  return memory;
}
export async function saveTokens(t: Tokens | null) {
  memory = t;
  loaded = true;
  try {
    if (web) { if (t) globalThis.localStorage?.setItem(KEY, JSON.stringify(t)); else globalThis.localStorage?.removeItem(KEY); }
    else if (t) await SecureStore.setItemAsync(KEY, JSON.stringify(t)); else await SecureStore.deleteItemAsync(KEY);
  } catch { /* storage failure: the session still works until the app closes */ }
}

let onLoggedOut: () => void = () => undefined;
export const setLoggedOutHandler = (fn: () => void) => { onLoggedOut = fn; };

async function raw(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${API_URL}/v1/${path.replace(/^\//, '')}`, init);
}
async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? 'Request failed', e?.details);
  }
  return body as T;
}

// One refresh at a time: refresh tokens rotate, so two parallel refreshes would log the user out.
let refreshing: Promise<boolean> | null = null;
function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    const t = await loadTokens();
    if (!t) return false;
    try {
      const res = await raw('auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: t.refresh }) });
      if (!res.ok) { if (res.status === 401) await saveTokens(null); return false; }
      const j = (await res.json()) as { access_token: string; refresh_token: string };
      await saveTokens({ access: j.access_token, refresh: j.refresh_token });
      return true;
    } catch { return false; }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; rawBody?: Blob; headers?: Record<string, string>; auth?: boolean } = {}): Promise<T> {
  const send = async () => {
    const t = opts.auth === false ? null : await loadTokens();
    return raw(path, {
      method: opts.method ?? (opts.body !== undefined || opts.rawBody ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t.access}` } : {}), ...opts.headers },
      body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  };
  let res = await send();
  if (res.status === 401 && opts.auth !== false && (await loadTokens())) {
    if (await refreshTokens()) res = await send();
    else if (!(await loadTokens())) onLoggedOut();
  }
  return parse<T>(res);
}
