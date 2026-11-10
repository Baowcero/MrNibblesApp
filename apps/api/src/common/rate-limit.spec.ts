import { MemoryStore } from './rate-limit.js';

describe('MemoryStore', () => {
  it('counts hits inside a window and resets when the window ends', async () => {
    let t = 1_000_000;
    const s = new MemoryStore(() => t);
    expect(await s.hit('k', 60)).toBe(1);
    expect(await s.hit('k', 60)).toBe(2);
    expect(await s.count('k')).toBe(2);
    expect(await s.ttl('k')).toBe(60);
    t += 61_000;
    expect(await s.count('k')).toBe(0);
    expect(await s.hit('k', 60)).toBe(1);
  });

  it('reset clears the counter', async () => {
    const s = new MemoryStore();
    await s.hit('a', 60);
    await s.reset('a');
    expect(await s.count('a')).toBe(0);
  });
});
