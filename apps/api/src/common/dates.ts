const LAGOS_OFFSET_MS = 3_600_000;

/** Today's date in Lagos as YYYY-MM-DD. */
export function lagosToday(now = new Date()): string {
  return new Date(now.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

/** A Postgres DATE value for a YYYY-MM-DD string. */
export const toDateOnly = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The start and end of a Lagos calendar day, as real moments in time. */
export function lagosDayRange(ymd: string): { gte: Date; lt: Date } {
  const start = new Date(toDateOnly(ymd).getTime() - LAGOS_OFFSET_MS);
  return { gte: start, lt: new Date(start.getTime() + 86_400_000) };
}

/** True if the date is after today in Lagos. */
export const isFuture = (ymd: string, now = new Date()) => ymd > lagosToday(now);
