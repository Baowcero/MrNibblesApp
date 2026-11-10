import { dueReminders, remindersFor } from './reminders.js';

describe('booking reminders', () => {
  it('Monday has three morning reminders for the same day', () => {
    const r = remindersFor('2026-11-16'); // Monday
    expect(r.map((x) => x.label)).toEqual(['morning_0630', 'morning_0730', 'morning_0800']);
    expect(r[0]!.remindAt.toISOString()).toBe('2026-11-16T05:30:00.000Z'); // 06:30 Lagos
  });

  it('Friday adds two evening reminders for Saturday', () => {
    const r = remindersFor('2026-11-20'); // Friday
    expect(r.map((x) => x.label)).toContain('friday_1700');
    const evening = r.find((x) => x.label === 'friday_1800')!;
    expect(evening.deliveryDate).toBe('2026-11-21');
    expect(evening.remindAt.toISOString()).toBe('2026-11-20T17:00:00.000Z');
  });

  it('no reminders on Saturday or Sunday', () => {
    expect(remindersFor('2026-11-21')).toEqual([]);
    expect(remindersFor('2026-11-22')).toEqual([]);
  });

  it('only sends when due and not too late', () => {
    expect(dueReminders('2026-11-16', new Date('2026-11-16T05:29:00Z'))).toHaveLength(0);
    expect(dueReminders('2026-11-16', new Date('2026-11-16T05:31:00Z')).map((x) => x.label)).toEqual(['morning_0630']);
    expect(dueReminders('2026-11-16', new Date('2026-11-16T05:55:00Z'))).toHaveLength(0);
  });
});
