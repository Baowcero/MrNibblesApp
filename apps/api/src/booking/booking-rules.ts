const LAGOS_OFFSET_MS = 3_600_000; // Africa/Lagos is UTC+1 all year (no daylight saving)
const pad = (n: number) => String(n).padStart(2, '0');

const lagosInstant = (y: number, m: number, d: number, h: number, min: number) =>
  new Date(Date.UTC(y, m, d, h, min) - LAGOS_OFFSET_MS);

export type NextDelivery = {
  /** Delivery (or pickup) day as YYYY-MM-DD, Lagos calendar. */
  date: string;
  /** Moment booking for that day closes. */
  closesAt: Date;
  /** True when the order can still be delivered today. */
  isToday: boolean;
};

/**
 * The earliest day an order placed at `now` can be delivered.
 * - Monday to Friday: booking for the day closes at the cut-off (08:30).
 * - Saturday: booking closes Friday night (Saturday 00:00).
 * - Sunday: no delivery.
 */
export function nextDelivery(now: Date, cutoffTime = '08:30'): NextDelivery {
  const [ch, cm] = cutoffTime.split(':').map(Number) as [number, number];
  const local = new Date(now.getTime() + LAGOS_OFFSET_MS);
  const y0 = local.getUTCFullYear();
  const m0 = local.getUTCMonth();
  const d0 = local.getUTCDate();

  for (let i = 0; i < 8; i++) {
    const day = new Date(Date.UTC(y0, m0, d0 + i));
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth();
    const d = day.getUTCDate();
    const dow = day.getUTCDay(); // 0 Sunday ... 6 Saturday
    if (dow === 0) continue;
    const closesAt = dow === 6 ? lagosInstant(y, m, d, 0, 0) : lagosInstant(y, m, d, ch, cm);
    if (closesAt.getTime() > now.getTime()) {
      return { date: `${y}-${pad(m + 1)}-${pad(d)}`, closesAt, isToday: i === 0 };
    }
  }
  throw new Error('No delivery day found');
}
