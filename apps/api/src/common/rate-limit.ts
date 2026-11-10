import { Global, Injectable, Logger, Module } from '@nestjs/common';

/** Counters with a time window. Redis when it is reachable (shared between API instances), memory otherwise. */
export interface CounterStore {
  /** Adds one and returns the new count. The window starts at the first hit. */
  hit(key: string, windowSec: number): Promise<number>;
  count(key: string): Promise<number>;
  /** Seconds until the counter resets (0 if there is none). */
  ttl(key: string): Promise<number>;
  reset(key: string): Promise<void>;
}

export class MemoryStore implements CounterStore {
  private map = new Map<string, { n: number; until: number }>();
  constructor(private now: () => number = Date.now) {}

  private live(key: string) {
    const e = this.map.get(key);
    if (e && e.until <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return e;
  }
  async hit(key: string, windowSec: number) {
    const e = this.live(key);
    if (e) return ++e.n;
    this.map.set(key, { n: 1, until: this.now() + windowSec * 1000 });
    if (this.map.size > 10_000) for (const k of this.map.keys()) this.live(k); // drop expired entries
    return 1;
  }
  async count(key: string) {
    return this.live(key)?.n ?? 0;
  }
  async ttl(key: string) {
    const e = this.live(key);
    return e ? Math.ceil((e.until - this.now()) / 1000) : 0;
  }
  async reset(key: string) {
    this.map.delete(key);
  }
}

class RedisStore implements CounterStore {
  constructor(private r: any) {}
  async hit(key: string, windowSec: number) {
    const n = await this.r.incr(key);
    if (n === 1) await this.r.expire(key, windowSec);
    return n as number;
  }
  async count(key: string) {
    return Number((await this.r.get(key)) ?? 0);
  }
  async ttl(key: string) {
    return Math.max(0, Number(await this.r.ttl(key)));
  }
  async reset(key: string) {
    await this.r.del(key);
  }
}

@Injectable()
export class RateLimiter {
  private readonly log = new Logger('RateLimit');
  private store: CounterStore | undefined;

  private async get(): Promise<CounterStore> {
    if (this.store) return this.store;
    const url = process.env.REDIS_URL;
    if (url) {
      try {
        const name = 'ioredis';
        const Redis: any = (await import(name)).default;
        const client = new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: true });
        client.on('error', () => undefined); // a Redis outage must not crash the API
        await client.connect();
        await client.ping();
        return (this.store = new RedisStore(client));
      } catch (e) {
        this.log.warn(`Redis not available for rate limiting (${(e as Error).message}). Using memory: fine for one API instance.`);
      }
    }
    return (this.store = new MemoryStore());
  }

  async hit(key: string, windowSec: number) {
    return (await this.get()).hit(key, windowSec);
  }
  async count(key: string) {
    return (await this.get()).count(key);
  }
  async ttl(key: string) {
    return (await this.get()).ttl(key);
  }
  async reset(key: string) {
    return (await this.get()).reset(key);
  }
}

@Global()
@Module({ providers: [RateLimiter], exports: [RateLimiter] })
export class RateLimitModule {}
