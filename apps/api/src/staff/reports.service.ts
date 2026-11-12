import { Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { DATE_PATTERN, lagosToday, toDateOnly } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';

const COUNTED = ['paid', 'assigned', 'out_for_delivery', 'delivered', 'ready', 'collected'] as const;
const DAY = 86400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sales report for a delivery-date range, with the equal-length period before it for comparison. */
  async sales(from?: string, to?: string) {
    const end = to ?? lagosToday();
    const start = from ?? ymd(new Date(toDateOnly(end).getTime() - 29 * DAY));
    if (!DATE_PATTERN.test(start) || !DATE_PATTERN.test(end) || start > end) throw new AppError(400, 'invalid_range', 'Choose a valid date range');
    const days = Math.round((toDateOnly(end).getTime() - toDateOnly(start).getTime()) / DAY) + 1;
    if (days > 366) throw new AppError(400, 'range_too_long', 'Choose a range of one year or less');
    const prevEnd = ymd(new Date(toDateOnly(start).getTime() - DAY));
    const prevStart = ymd(new Date(toDateOnly(start).getTime() - days * DAY));

    const orders = await this.prisma.order.findMany({
      where: { deliveryDate: { gte: toDateOnly(prevStart), lte: toDateOnly(end) }, status: { in: [...COUNTED] } },
      include: {
        items: { include: { product: true } },
        customer: { select: { id: true, businessName: true, createdAt: true } },
        location: { include: { area: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const cur = orders.filter((o) => ymd(o.deliveryDate) >= start);
    const prev = orders.filter((o) => ymd(o.deliveryDate) <= prevEnd);

    const totals = (rows: typeof orders) => {
      const revenue = rows.reduce((n, o) => n + Number(o.totalKobo), 0);
      const loaves = rows.reduce((n, o) => n + o.items.reduce((m, i) => m + i.quantity, 0), 0);
      return {
        revenue_kobo: revenue,
        orders: rows.length,
        loaves,
        avg_order_kobo: rows.length ? Math.round(revenue / rows.length) : 0,
        customers: new Set(rows.map((o) => o.customerId)).size,
      };
    };
    const series = (rows: typeof orders, first: string) => {
      const map = new Map<string, { revenue_kobo: number; orders: number; loaves: number }>();
      for (let i = 0; i < days; i++) map.set(ymd(new Date(toDateOnly(first).getTime() + i * DAY)), { revenue_kobo: 0, orders: 0, loaves: 0 });
      for (const o of rows) {
        const d = map.get(ymd(o.deliveryDate));
        if (!d) continue;
        d.revenue_kobo += Number(o.totalKobo);
        d.orders += 1;
        d.loaves += o.items.reduce((m, i) => m + i.quantity, 0);
      }
      return [...map.entries()].map(([date, v]) => ({ date, ...v }));
    };

    const prod = new Map<string, { name: string; loaves: number; revenue_kobo: number }>();
    const methods = new Map<string, { orders: number; revenue_kobo: number }>();
    const areas = new Map<string, { orders: number; revenue_kobo: number }>();
    const custs = new Map<string, { id: string; name: string; orders: number; revenue_kobo: number }>();
    for (const o of cur) {
      for (const i of o.items) {
        const p = prod.get(i.productId) ?? { name: i.product.name, loaves: 0, revenue_kobo: 0 };
        p.loaves += i.quantity;
        p.revenue_kobo += Number(i.lineTotalKobo);
        prod.set(i.productId, p);
      }
      const m = o.payments[0]?.method ?? 'paystack';
      const pm = methods.get(m) ?? { orders: 0, revenue_kobo: 0 };
      pm.orders += 1; pm.revenue_kobo += Number(o.totalKobo); methods.set(m, pm);
      const a = o.location?.area.name ?? (o.fulfilment === 'pickup' ? 'Pickup' : 'Unknown');
      const pa = areas.get(a) ?? { orders: 0, revenue_kobo: 0 };
      pa.orders += 1; pa.revenue_kobo += Number(o.totalKobo); areas.set(a, pa);
      const c = custs.get(o.customerId) ?? { id: o.customerId, name: o.customer.businessName, orders: 0, revenue_kobo: 0 };
      c.orders += 1; c.revenue_kobo += Number(o.totalKobo); custs.set(o.customerId, c);
    }
    const totalRevenue = totals(cur).revenue_kobo || 1;
    const newCustomers = await this.prisma.customer.count({ where: { createdAt: { gte: toDateOnly(start), lt: new Date(toDateOnly(end).getTime() + DAY) } } });

    // Money in versus money still expected, for orders delivered in the range (placed orders not yet paid are pending).
    const pending = await this.prisma.order.aggregate({
      where: { deliveryDate: { gte: toDateOnly(start), lte: toDateOnly(end) }, status: 'placed' },
      _sum: { totalKobo: true },
      _count: { _all: true },
    });

    return {
      range: { from: start, to: end, days, previous_from: prevStart, previous_to: prevEnd },
      current: { ...totals(cur), new_customers: newCustomers },
      previous: totals(prev),
      daily: series(cur, start),
      previous_daily: series(prev, prevStart),
      by_product: [...prod.values()].sort((a, b) => b.revenue_kobo - a.revenue_kobo).map((p) => ({ ...p, share: p.revenue_kobo / totalRevenue })),
      by_method: [...methods.entries()].map(([method, v]) => ({ method, ...v })),
      by_area: [...areas.entries()].map(([area, v]) => ({ area, ...v })).sort((a, b) => b.revenue_kobo - a.revenue_kobo),
      top_customers: [...custs.values()].sort((a, b) => b.revenue_kobo - a.revenue_kobo).slice(0, 10),
      awaiting_payment: { orders: pending._count._all, amount_kobo: Number(pending._sum.totalKobo ?? 0n) },
    };
  }
}
