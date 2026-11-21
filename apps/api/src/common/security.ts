import { Logger } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import type { NextFunction, Request, Response } from 'express';
import type { RateLimiter } from './rate-limit.js';

const log = new Logger('Security');
const isProd = () => process.env.NODE_ENV === 'production';

/** Where this API is called from by a browser. The phone apps send no Origin header, and the dashboard calls from its own server, so neither is affected. */
export function corsOptions(): CorsOptions {
  const allowed = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
  return {
    origin(origin, done) {
      if (!origin) return done(null, true); // not a browser: phone app, server to server, curl
      if (allowed.includes(origin.replace(/\/$/, ''))) return done(null, true);
      // Local development: allow any origin when nothing is configured. In production an empty list allows no browser at all.
      return done(null, !isProd() && allowed.length === 0);
    },
    credentials: false,
    maxAge: 600,
  };
}

/** Standard protective headers. This API only returns JSON (and one tiny return page), so the policy is strict. */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // The Paystack return page needs its inline script and style; everything else gets nothing.
  const returnPage = req.path.endsWith('/payments/return');
  res.setHeader(
    'Content-Security-Policy',
    returnPage ? "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'" : "default-src 'none'; frame-ancestors 'none'",
  );
  res.setHeader('Cache-Control', 'no-store');
  if (isProd()) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}

/** "1" (one proxy in front), "loopback", an address list... or false when the API is reached directly. */
export function trustProxySetting(): boolean | number | string {
  const v = process.env.TRUST_PROXY?.trim();
  if (!v || v === 'false') return false;
  if (v === 'true') return 1;
  return /^\d+$/.test(v) ? Number(v) : v;
}

const EXEMPT = /\/(webhooks\/|health$)/;

/**
 * Flood protection in front of everything, including requests with bad tokens.
 * One IP can make this many requests a minute. Set high on purpose: the dashboard's server and
 * phone networks put many people behind one address. The per-person limits are in RateLimitGuard.
 */
export function ipFloodLimit(limiter: RateLimiter) {
  const perMinute = Number(process.env.RATE_LIMIT_IP_PER_MIN ?? 1200);
  return async (req: Request, res: Response, next: NextFunction) => {
    if (EXEMPT.test(req.path)) return next();
    try {
      const n = await limiter.hit(`rl:ip:${req.ip}`, 60);
      if (n > perMinute) {
        const retry = Math.max(1, await limiter.ttl(`rl:ip:${req.ip}`));
        res.setHeader('Retry-After', String(retry));
        return void res.status(429).json({ error: { code: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' } });
      }
    } catch { /* if the counter store is down, let the request through */ }
    next();
  };
}

/**
 * Checks the settings before the API starts. In production a problem stops the start-up,
 * so a weak key or a missing setting is found at deploy time and not by an attacker.
 */
export function checkEnvironment() {
  const problems: string[] = [];
  const warnings: string[] = [];
  const secret = process.env.JWT_ACCESS_SECRET ?? '';
  if (secret.length < 32) problems.push('JWT_ACCESS_SECRET must be at least 32 characters. Make one with: openssl rand -base64 48');
  if (/change.?me|example|secret|xxx|password/i.test(secret)) problems.push('JWT_ACCESS_SECRET looks like a placeholder. Use a random value.');
  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set.');
  if (!process.env.PAYSTACK_SECRET_KEY) problems.push('PAYSTACK_SECRET_KEY is not set, so payments and the webhook cannot work.');

  if (isProd()) {
    if (!(process.env.CORS_ORIGINS ?? '').trim()) warnings.push('CORS_ORIGINS is empty: no browser can call the API directly. That is fine if only the dashboard server and the phone apps use it.');
    if (process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_test')) warnings.push('PAYSTACK_SECRET_KEY is a TEST key. Real money will not move.');
    if (!process.env.PAYSTACK_CALLBACK_URL?.startsWith('https://')) warnings.push('PAYSTACK_CALLBACK_URL should be an https:// address in production.');
    if (!process.env.REDIS_URL) warnings.push('REDIS_URL is not set: rate limits are kept in memory. Fine for one API instance only.');
    if (!process.env.TRUST_PROXY) warnings.push('TRUST_PROXY is not set. Behind a load balancer or proxy, set it (for example 1) so rate limits see the real client IP.');
    if (process.env.DISABLE_JOBS === '1') warnings.push('DISABLE_JOBS=1: notifications and reminders will not be sent.');
  }

  warnings.forEach((w) => log.warn(w));
  if (problems.length === 0) return;
  const text = `Unsafe configuration:\n - ${problems.join('\n - ')}`;
  if (isProd()) throw new Error(text);
  log.warn(`${text}\n(Only a warning outside production.)`);
}
