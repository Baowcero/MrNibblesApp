import { isFuture, lagosDayRange, lagosToday } from './dates.js';

describe('lagos dates', () => {
  it('uses the Lagos calendar for today', () => {
    expect(lagosToday(new Date('2026-11-15T23:30:00Z'))).toBe('2026-11-16');
    expect(lagosToday(new Date('2026-11-15T22:30:00Z'))).toBe('2026-11-15');
  });

  it('a Lagos day runs from 23:00Z the day before', () => {
    const r = lagosDayRange('2026-11-16');
    expect(r.gte.toISOString()).toBe('2026-11-15T23:00:00.000Z');
    expect(r.lt.toISOString()).toBe('2026-11-16T23:00:00.000Z');
  });

  it('knows future dates', () => {
    expect(isFuture('2026-11-17', new Date('2026-11-16T10:00:00Z'))).toBe(true);
    expect(isFuture('2026-11-16', new Date('2026-11-16T10:00:00Z'))).toBe(false);
  });
});
