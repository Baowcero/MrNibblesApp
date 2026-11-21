import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from './app-error.js';
import type { AuthedRequest } from './auth.js';
import { RateLimiter } from './rate-limit.js';

interface Rule { name: string; method?: string; match: RegExp; limit: number; windowSec: number }

/** Tighter limits for the actions that cost money, create records or take uploads. Everything else gets the default. */
const RULES: Rule[] = [
  { name: 'auth', match: /\/auth\//, limit: Number(process.env.RATE_LIMIT_AUTH_PER_MIN ?? 30), windowSec: 60 },
  { name: 'pay', match: /\/orders\/[^/]+\/pay/, limit: 20, windowSec: 60 },
  { name: 'order', method: 'POST', match: /\/orders\/?$/, limit: 20, windowSec: 60 },
  { name: 'issue', method: 'POST', match: /\/orders\/[^/]+\/issues/, limit: 20, windowSec: 60 },
  { name: 'upload', match: /\/uploads\//, limit: 60, windowSec: 60 },
  { name: 'cash', match: /\/staff\/payments\/cash/, limit: 60, windowSec: 60 },
];
const DEFAULT = { name: 'default', limit: Number(process.env.RATE_LIMIT_USER_PER_MIN ?? 300), windowSec: 60 };

/**
 * Per-person limits. Runs after login is checked, so a signed-in person is counted by their account
 * (not by the IP they share with a whole shop or phone network) and a visitor by their IP.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly limiter: RateLimiter) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const path = req.path;
    if (/\/(webhooks\/|health$)/.test(path)) return true;

    const rule = RULES.find((r) => (!r.method || r.method === req.method) && r.match.test(path)) ?? DEFAULT;
    const who = req.user?.id ?? `ip:${req.ip}`;
    const key = `rl:${rule.name}:${who}`;
    try {
      const n = await this.limiter.hit(key, rule.windowSec);
      if (n > rule.limit) {
        http.getResponse<Response>().setHeader('Retry-After', String(Math.max(1, await this.limiter.ttl(key))));
        throw new AppError(429, 'rate_limited', 'Too many requests. Please wait a moment and try again.');
      }
    } catch (e) {
      if (e instanceof AppError) throw e; // a store failure lets the request through
    }
    return true;
  }
}
