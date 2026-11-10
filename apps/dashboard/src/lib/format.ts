/** Money is stored in kobo. The dashboard always shows naira. */
export function formatNaira(kobo: number | null | undefined, opts: { compact?: boolean } = {}) {
  const n = (kobo ?? 0) / 100;
  if (opts.compact && Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}

export const formatNumber = (n: number) => n.toLocaleString('en-NG');

/** Today in Lagos as YYYY-MM-DD. */
export function lagosToday(now = new Date()) {
  return new Date(now.getTime() + 3_600_000).toISOString().slice(0, 10);
}

export function shiftDate(ymd: string, days: number) {
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export function formatDate(ymd: string) {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
}

export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
