const LAGOS_OFFSET_MS = 3_600_000;

/** Today's date in Lagos as YYYY-MM-DD. */
export function lagosToday(now = new Date()): string {
  return new Date(now.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

/** A Postgres DATE value for a YYYY-MM-DD string. */
export const toDateOnly = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
