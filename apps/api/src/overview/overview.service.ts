import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { Roles } from '../common/auth.js';
import { lagosDayRange, lagosToday, toDateOnly } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DateQueryDto } from '../staff/orders.dto.js';

const dayBefore = (ymd: string, n: number) => new Date(toDateOnly(ymd).getTime() - n * 86_400_000).toISOString().slice(0, 10);

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async get(date?: string) {
    const d = date ?? lagosToday();
    const from = dayBefore(d, 6);
    const week = Array.from({ length: 7 }, (_, i) => dayBefore(d, 6 - i));

    const [orders, payments, customers, openIssues, materials, stock, runs] = await Promise.all([
      this.prisma.order.findMany({ where: { deliveryDate: { gte: toDateOnly(from), lte: toDateOnly(d) } }, include: { items: true } }),
      this.prisma.payment.findMany({ where: { status: 'succeeded', paidAt: { gte: lagosDayRange(from).gte, lt: lagosDayRange(d).lt } } }),
      this.prisma.customer.groupBy({ by: ['status'], _count: true }),
      this.prisma.orderIssue.count({ where: { status: 'open' } }),
      this.prisma.rawMaterial.findMany({ where: { isActive: true, reorderLevel: { not: null } } }),
      this.prisma.rawMaterialMovement.groupBy({ by: ['rawMaterialId'], _sum: { quantity: true } }),
      this.prisma.productionRun.findMany({ where: { runDate: toDateOnly(d) }, include: { outputs: true } }),
    ]);

    const todays = orders.filter((o) => o.deliveryDate.toISOString().slice(0, 10) === d);
    const by_status: Record<string, number> = {};
    for (const o of todays) by_status[o.status] = (by_status[o.status] ?? 0) + 1;

    const money = (rows: typeof payments) => ({
      amount_kobo: rows.reduce((s, p) => s + Number(p.amountKobo), 0),
      paystack_fees_kobo: rows.reduce((s, p) => s + Number(p.feeKobo), 0),
    });
    const lagosDay = (t: Date) => lagosToday(t);

    const stockOf = new Map(stock.map((s) => [s.rawMaterialId, Number(s._sum.quantity ?? 0)]));
    const lowStock = materials.filter((m) => (stockOf.get(m.id) ?? 0) <= Number(m.reorderLevel));

    const cust = Object.fromEntries(customers.map((c) => [c.status, c._count]));

    return {
      date: d,
      today: {
        orders: todays.length,
        loaves: todays.reduce((s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0), 0),
        by_status,
        payments_received: money(payments.filter((p) => p.paidAt && lagosDay(p.paidAt) === d)),
        bread_produced: runs.reduce((s, r) => s + r.outputs.reduce((n, o) => n + o.quantity, 0), 0),
        runs_recorded: runs.map((r) => r.runType),
      },
      last_7_days: week.map((day) => {
        const os = orders.filter((o) => o.deliveryDate.toISOString().slice(0, 10) === day);
        return {
          date: day,
          orders: os.length,
          loaves: os.reduce((s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0), 0),
          paid_kobo: money(payments.filter((p) => p.paidAt && lagosDay(p.paidAt) === day)).amount_kobo,
        };
      }),
      customers: { active: cust.active ?? 0, pending_approval: cust.pending_approval ?? 0, unclaimed: cust.unclaimed ?? 0, suspended: cust.suspended ?? 0 },
      attention: {
        open_issues: openIssues,
        pending_approvals: cust.pending_approval ?? 0,
        low_stock: lowStock.map((m) => ({ id: m.id, name: m.name, unit: m.unit, in_stock: stockOf.get(m.id) ?? 0, reorder_level: Number(m.reorderLevel) })),
      },
    };
  }
}

@Roles('ceo', 'accounts')
@Controller('staff/overview')
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  get(@Query() q: DateQueryDto) {
    return this.overview.get(q.date);
  }
}

@Module({ controllers: [OverviewController], providers: [OverviewService] })
export class OverviewModule {}
