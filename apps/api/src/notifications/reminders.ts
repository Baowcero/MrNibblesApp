/**
 * Booking reminders. Mon to Fri: 06:30, 07:30 and 08:00 for that day's delivery (booking closes 08:30).
 * Friday also: 17:00 and 18:00 for Saturday's delivery (Saturday booking closes at midnight Friday).
 * All times are Lagos time (UTC+1, no daylight saving).
 */
export interface Reminder {
  label: string;
  deliveryDate: string; // YYYY-MM-DD
  remindAt: Date;
  title: string;
  body: string;
}

/** How late a reminder may still be sent if the server was briefly down. */
export const REMINDER_GRACE_MINUTES = 20;

const at = (ymd: string, hh: number, mm: number) => {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, hh - 1, mm)); // Lagos is UTC+1
};

const addDay = (ymd: string) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);

export function remindersFor(lagosDate: string): Reminder[] {
  const dow = new Date(`${lagosDate}T00:00:00Z`).getUTCDay(); // 0 Sunday ... 6 Saturday
  if (dow === 0 || dow === 6) return [];
  const title = 'Mr Nibbles';
  const list: Reminder[] = [
    { label: 'morning_0630', deliveryDate: lagosDate, remindAt: at(lagosDate, 6, 30), title, body: "Good morning! Order before 8:30 AM for today's delivery." },
    { label: 'morning_0730', deliveryDate: lagosDate, remindAt: at(lagosDate, 7, 30), title, body: 'One hour left to order for today. Booking closes at 8:30 AM.' },
    { label: 'morning_0800', deliveryDate: lagosDate, remindAt: at(lagosDate, 8, 0), title, body: '30 minutes left to order for today.' },
  ];
  if (dow === 5) {
    const sat = addDay(lagosDate);
    list.push(
      { label: 'friday_1700', deliveryDate: sat, remindAt: at(lagosDate, 17, 0), title, body: 'Order today for Saturday delivery. Booking closes at midnight.' },
      { label: 'friday_1800', deliveryDate: sat, remindAt: at(lagosDate, 18, 0), title, body: 'Last chance tonight to order for Saturday.' },
    );
  }
  return list;
}

/** Reminders whose time has come and is not older than the grace period. */
export function dueReminders(lagosDate: string, now: Date): Reminder[] {
  return remindersFor(lagosDate).filter((r) => {
    const late = now.getTime() - r.remindAt.getTime();
    return late >= 0 && late <= REMINDER_GRACE_MINUTES * 60_000;
  });
}
