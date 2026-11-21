import { RateLimitGuard } from './rate-limit.guard.js';
import { MemoryStore, type RateLimiter } from './rate-limit.js';
import { checkEnvironment, corsOptions, trustProxySetting } from './security.js';

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

function allowed(origin: string | undefined) {
  let result: unknown;
  (corsOptions().origin as (o: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => void)(origin, (_e, ok) => { result = ok; });
  return result;
}

describe('corsOptions', () => {
  it('lets non-browser callers through (no Origin header)', () => {
    process.env.NODE_ENV = 'production';
    expect(allowed(undefined)).toBe(true);
  });
  it('in production only allows the listed origins', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://dash.example.com/, https://admin.example.com';
    expect(allowed('https://dash.example.com')).toBe(true);
    expect(allowed('https://evil.example.com')).toBe(false);
  });
  it('in production with no list allows no browser', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGINS;
    expect(allowed('https://dash.example.com')).toBe(false);
  });
  it('in development with no list allows any origin', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CORS_ORIGINS;
    expect(allowed('http://localhost:3000')).toBe(true);
  });
});

describe('trustProxySetting', () => {
  it('is off by default and reads numbers and names', () => {
    delete process.env.TRUST_PROXY;
    expect(trustProxySetting()).toBe(false);
    process.env.TRUST_PROXY = '1';
    expect(trustProxySetting()).toBe(1);
    process.env.TRUST_PROXY = 'loopback';
    expect(trustProxySetting()).toBe('loopback');
  });
});

describe('checkEnvironment', () => {
  it('stops production start-up on a weak secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'short';
    process.env.DATABASE_URL = 'postgres://x';
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_x';
    expect(() => checkEnvironment()).toThrow(/JWT_ACCESS_SECRET/);
  });
  it('accepts a strong secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_ACCESS_SECRET = 'k9Zq3vXw8LmN2pRt6YbHc4JdFs7GuA1eQo5WiTx0VnMy';
    process.env.DATABASE_URL = 'postgres://x';
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_x';
    expect(() => checkEnvironment()).not.toThrow();
  });
  it('only warns outside production', () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_ACCESS_SECRET = 'short';
    expect(() => checkEnvironment()).not.toThrow();
  });
});

describe('RateLimitGuard', () => {
  const store = new MemoryStore();
  const limiter = { hit: (k: string, w: number) => store.hit(k, w), ttl: (k: string) => store.ttl(k) } as unknown as RateLimiter;
  const guard = new RateLimitGuard(limiter);
  const ctx = (method: string, path: string, user?: { id: string }) => {
    const headers: Record<string, string> = {};
    return {
      switchToHttp: () => ({
        getRequest: () => ({ method, path, ip: '1.2.3.4', user }),
        getResponse: () => ({ setHeader: (k: string, v: string) => { headers[k] = v; } }),
      }),
    } as never;
  };

  it('blocks the 21st order in a minute for one person, but not for someone else', async () => {
    for (let i = 0; i < 20; i++) expect(await guard.canActivate(ctx('POST', '/v1/orders', { id: 'u1' }))).toBe(true);
    await expect(guard.canActivate(ctx('POST', '/v1/orders', { id: 'u1' }))).rejects.toMatchObject({ code: 'rate_limited' });
    expect(await guard.canActivate(ctx('POST', '/v1/orders', { id: 'u2' }))).toBe(true);
  });
  it('never limits the Paystack webhook or the health check', async () => {
    for (let i = 0; i < 500; i++) expect(await guard.canActivate(ctx('POST', '/v1/webhooks/paystack'))).toBe(true);
    expect(await guard.canActivate(ctx('GET', '/v1/health'))).toBe(true);
  });
});
