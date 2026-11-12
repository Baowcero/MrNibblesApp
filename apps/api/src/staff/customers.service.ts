import { Injectable } from '@nestjs/common';
import type { CustomerStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import { queueNotification } from '../notifications/queue.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListCustomersDto } from './customers.dto.js';

const PAID_STATUSES = ['paid', 'assigned', 'out_for_delivery', 'delivered', 'ready', 'collected'] as const;
const EMPTY_STATS = { orders_count: 0, total_paid_kobo: 0, last_order_at: null as Date | null };

@Injectable()
export class StaffCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(dto: ListCustomersDto) {
    const limit = dto.limit ?? 50;
    const where: Prisma.CustomerWhereInput = {};
    if (dto.status) where.status = dto.status;
    if (dto.q) where.businessName = { contains: dto.q.trim(), mode: 'insensitive' };
    const rows = await this.prisma.customer.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      include: {
        user: { select: { fullName: true, phone: true, email: true } },
        locations: { where: { isDefault: true, isActive: true }, include: { area: true }, take: 1 },
      },
    });
    const page = rows.slice(0, limit);
    const stats = await this.statsFor(page.map((c) => c.id));
    return {
      data: page.map((c) => ({
        ...(stats.get(c.id) ?? EMPTY_STATS),
        id: c.id,
        business_name: c.businessName,
        status: c.status,
        source: c.source,
        contact_name: c.user?.fullName ?? null,
        phone: c.user?.phone ?? null,
        email: c.user?.email ?? null,
        address: c.locations[0]?.address ?? null,
        area: c.locations[0]?.area.name ?? null,
        claimed_at: c.claimedAt,
        approved_at: c.approvedAt,
        created_at: c.createdAt,
        rejection_note: c.rejectionNote,
      })),
      next_cursor: rows.length > limit ? page[page.length - 1]!.id : null,
    };
  }

  /** Orders, money and last order per customer. Only orders that were paid for count towards spend. */
  private async statsFor(ids: string[]) {
    const out = new Map<string, typeof EMPTY_STATS>();
    if (ids.length === 0) return out;
    const rows = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: { customerId: { in: ids }, status: { in: [...PAID_STATUSES] } },
      _count: { _all: true },
      _sum: { totalKobo: true },
      _max: { placedAt: true },
    });
    for (const r of rows) {
      out.set(r.customerId, { orders_count: r._count._all, total_paid_kobo: Number(r._sum.totalKobo ?? 0n), last_order_at: r._max.placedAt });
    }
    return out;
  }

  async summary() {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const dayStart = new Date(Date.now() + 3_600_000);
    dayStart.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(dayStart.getTime() - 3_600_000);
    const [byStatus, newThisMonth, ordering, everOrdered, newToday, savers] = await Promise.all([
      this.prisma.customer.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.customer.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.order.groupBy({
        by: ['customerId'],
        where: { placedAt: { gte: new Date(Date.now() - 30 * 86400_000) }, status: { in: [...PAID_STATUSES] } },
      }),
      this.prisma.order.groupBy({ by: ['customerId'], where: { status: { in: [...PAID_STATUSES] } }, _count: { _all: true } }),
      this.prisma.customer.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.savingsLedger.groupBy({ by: ['customerId'] }),
    ]);
    const returning = everOrdered.filter((r) => r._count._all >= 2).length;
    const n = (st: CustomerStatus) => byStatus.find((b) => b.status === st)?._count._all ?? 0;
    return {
      total: byStatus.reduce((a, b) => a + b._count._all, 0),
      active: n('active'),
      pending_approval: n('pending_approval'),
      unclaimed: n('unclaimed'),
      suspended: n('suspended'),
      rejected: n('rejected'),
      new_this_month: newThisMonth,
      ordered_last_30_days: ordering.length,
      new_today: newToday,
      returning_rate: everOrdered.length ? returning / everOrdered.length : 0,
      savings_members: savers.length,
    };
  }

  async detail(id: string) {
    const c = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true, phone: true, email: true, lastLoginAt: true } },
        locations: { where: { isActive: true }, include: { area: true }, orderBy: { isDefault: 'desc' } },
      },
    });
    if (!c) throw new AppError(404, 'customer_not_found', 'Customer not found');
    const [stats, recent, savings, issues] = await Promise.all([
      this.statsFor([id]),
      this.prisma.order.findMany({
        where: { customerId: id },
        orderBy: { placedAt: 'desc' },
        take: 20,
        include: { items: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      this.prisma.savingsLedger.findFirst({ where: { customerId: id }, orderBy: { createdAt: 'desc' }, select: { balanceAfterKobo: true } }),
      this.prisma.orderIssue.count({ where: { order: { customerId: id } } }),
    ]);
    const s = stats.get(id) ?? EMPTY_STATS;
    return {
      id: c.id,
      business_name: c.businessName,
      status: c.status,
      source: c.source,
      contact_name: c.user?.fullName ?? null,
      phone: c.user?.phone ?? null,
      email: c.user?.email ?? null,
      last_login_at: c.user?.lastLoginAt ?? null,
      created_at: c.createdAt,
      approved_at: c.approvedAt,
      rejection_note: c.rejectionNote,
      locations: c.locations.map((l) => ({ id: l.id, label: l.label, address: l.address, area: l.area.name, is_default: l.isDefault })),
      ...s,
      avg_order_kobo: s.orders_count ? Math.round(s.total_paid_kobo / s.orders_count) : 0,
      savings_kobo: Number(savings?.balanceAfterKobo ?? 0n),
      issues_count: issues,
      recent_orders: recent.map((o) => ({
        id: o.id,
        order_no: o.orderNo,
        status: o.status,
        placed_at: o.placedAt,
        delivery_date: o.deliveryDate.toISOString().slice(0, 10),
        fulfilment: o.fulfilment,
        bread_count: o.items.reduce((n, i) => n + i.quantity, 0),
        total_kobo: Number(o.totalKobo),
        payment_method: o.payments[0]?.method ?? null,
        payment_status: o.payments[0]?.status ?? null,
      })),
    };
  }

  approve(id: string, actorId: string, ip?: string) {
    return this.transition(id, actorId, ['pending_approval', 'rejected', 'suspended'], 'active', 'customer.approve', {}, ip);
  }

  reject(id: string, actorId: string, note: string, ip?: string) {
    return this.transition(id, actorId, ['pending_approval'], 'rejected', 'customer.reject', { rejectionNote: note }, ip);
  }

  suspend(id: string, actorId: string, ip?: string) {
    return this.transition(id, actorId, ['active'], 'suspended', 'customer.suspend', {}, ip);
  }

  private async transition(
    id: string,
    actorId: string,
    from: CustomerStatus[],
    to: CustomerStatus,
    action: string,
    extra: Prisma.CustomerUncheckedUpdateManyInput,
    ip?: string,
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new AppError(404, 'customer_not_found', 'Customer not found');
    if (!customer.userId) {
      throw new AppError(409, 'customer_not_claimed', 'This customer has not signed up yet');
    }
    if (!from.includes(customer.status)) {
      throw new AppError(409, 'invalid_status_transition', `A customer who is ${customer.status} cannot be set to ${to}`);
    }

    const data: Prisma.CustomerUncheckedUpdateManyInput =
      to === 'active'
        ? { status: to, approvedAt: new Date(), approvedById: actorId, rejectionNote: null }
        : { status: to, ...extra };

    // The extra status condition makes this safe if two staff act at the same moment.
    const result = await this.prisma.customer.updateMany({ where: { id, status: customer.status }, data });
    if (result.count === 0) {
      throw new AppError(409, 'invalid_status_transition', 'This customer was just changed by someone else. Refresh and try again.');
    }

    await this.audit.log({
      actorUserId: actorId,
      action,
      entityType: 'customer',
      entityId: id,
      before: { status: customer.status },
      after: { status: to, ...(extra.rejectionNote ? { note: String(extra.rejectionNote) } : {}) },
      ip,
    });
    if (to === 'active') {
      await queueNotification(this.prisma, { userId: customer.userId, type: 'account_update', title: 'Account approved', body: 'Your Mr Nibbles account is approved. You can start ordering.' });
    } else if (to === 'rejected') {
      await queueNotification(this.prisma, { userId: customer.userId, type: 'account_update', title: 'Account not approved', body: 'We could not approve your account. Please contact the bakery.' });
    }
    return { id, status: to };
  }
}
