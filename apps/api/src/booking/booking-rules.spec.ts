import { nextDelivery } from './booking-rules.js';

// Lagos is UTC+1, so 08:29 in Lagos is 07:29Z.
const lagos = (iso: string) => new Date(`${iso}+01:00`);

describe('nextDelivery', () => {
  it('Monday before the cut-off delivers the same day', () => {
    const r = nextDelivery(lagos('2026-11-09T08:29:00'));
    expect(r).toMatchObject({ date: '2026-11-09', isToday: true });
    expect(r.closesAt.toISOString()).toBe('2026-11-09T07:30:00.000Z');
  });

  it('exactly at 08:30 booking is closed, so it moves to Tuesday', () => {
    expect(nextDelivery(lagos('2026-11-09T08:30:00'))).toMatchObject({ date: '2026-11-10', isToday: false });
  });

  it('Friday morning before the cut-off is still Friday', () => {
    expect(nextDelivery(lagos('2026-11-13T07:00:00')).date).toBe('2026-11-13');
  });

  it('Friday after the cut-off goes to Saturday, until Friday midnight', () => {
    expect(nextDelivery(lagos('2026-11-13T09:00:00')).date).toBe('2026-11-14');
    expect(nextDelivery(lagos('2026-11-13T23:59:00')).date).toBe('2026-11-14');
  });

  it('Saturday orders are closed, so they go to Monday', () => {
    expect(nextDelivery(lagos('2026-11-14T00:00:00')).date).toBe('2026-11-16');
    expect(nextDelivery(lagos('2026-11-14T10:00:00')).date).toBe('2026-11-16');
  });

  it('Sunday goes to Monday, never Sunday', () => {
    expect(nextDelivery(lagos('2026-11-15T12:00:00')).date).toBe('2026-11-16');
  });

  it('uses the Lagos calendar, not UTC (23:30 UTC Sunday is already Monday 00:30 in Lagos)', () => {
    expect(nextDelivery(new Date('2026-11-15T23:30:00Z'))).toMatchObject({ date: '2026-11-16', isToday: true });
  });

  it('respects a different cut-off time', () => {
    expect(nextDelivery(lagos('2026-11-09T09:00:00'), '10:00').date).toBe('2026-11-09');
  });
});
