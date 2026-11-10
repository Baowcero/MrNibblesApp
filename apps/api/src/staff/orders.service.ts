import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import { lagosToday, toDateOnly } from '../common/dates.js';
import { OrderStatusService } from '../orders/order-status.service.js';
import { queueNotification } from '../notifications/queue.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { StaffOrdersQueryDto } from './orders.dto.js';

const LIST_INCLUDE = {
  customer: true,
  location: { include: { area: true } },
  items: { include: { product: true } },
  payments: { orderBy: { createdAt: 'desc' }, take: 1 },
  delivery: { include: { distributor: { include: { user: true } } } },
} as const;
type OrderRow = Prisma.OrderGetPayload<{ include: typeof LIST_INCLUDE }>;

const COUNTED_FOR_PRODUCTION = ['paid', 'assigned', 'out_for_delivery', 'delivered', 'ready', 'collected'] as const;

@Injectable()
export class StaffOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: OrderStatusService,
    private readonly audit: AuditService,
  ) {}

  private row(o: OrderRow) {
    const pay = o.payments[0];
    return {
      id: o.id,
      order_no: o.orderNo,
      business_name: o.customer.businessName,
      fulfilment: o.fulfilment,
      status: o.status,
      delivery_date: o.deliveryDate.toISOString().slice(0, 10),
      area: o.location?.area.name ?? null,
      address: o.location?.address ?? null,
      items: o.items.map((i) => ({ name: i.product.name, quantity: i.quantity })),
      bread_count: o.items.reduce((n, i) => n + i.quantity, 0),
      total_kobo: Number(o.totalKobo),
      payment: pay ? { method: pay.method, status: pay.status } : null,
      distributor: o.delivery
        ? { id: o.delivery.distributorId, full_name: o.delivery.distributor.user.fullName }
        : null,
    };
  }

  async list(dto: StaffOrdersQueryDto) {
    const limit = dto.limit ?? 100;
    const where: Prisma.OrderWhereInput = { deliveryDate: toDateOnly(dto.date ?? lagosToday()) };
    if (dto.status) where.status = dto.status;
    if (dto.fulfilment) where.fulfilment = dto.fulfilment;
    if (dto.area_id) where.location = { areaId: dto.area_id };
    if (dto.q) {
      where.OR = [
        { orderNo: { contains: dto.q.trim().toUpperCase() } },
        { customer: { businessName: { contains: dto.q.trim(), mode: 'insensitive' } } },
      ];
    }
    const rows = await this.prisma.order.findMany({
      where,
      orderBy: [{ placedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      include: LIST_INCLUDE,
    });
    const page = rows.slice(0, limit);
    return { data: page.map((o) => this.row(o)), next_cursor: rows.length > limit ? page[page.length - 1]!.id : null };
  }

  /** Counts by status, and how much bread is needed that day. Used by sales, production and the CEO overview. */
  async summary(date?: string) {
    const day = toDateOnly(date ?? lagosToday());
    const [byStatus, bread] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: { deliveryDate: day }, _count: { _all: true } }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { deliveryDate: day, status: { in: [...COUNTED_FOR_PRODUCTION] } } },
        _sum: { quantity: true },
      }),
    ]);
    const products = await this.prisma.product.findMany({ where: { id: { in: bread.map((b) => b.productId) } } });
    return {
      date: day.toISOString().slice(0, 10),
      orders_by_status: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      bread_needed: bread.map((b) => ({
        product_id: b.productId,
        name: products.find((p) => p.id === b.productId)?.name ?? '',
        quantity: b._sum.quantity ?? 0,
      })),
    };
  }

  async detail(orderId: string) {
    const o = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { ...LIST_INCLUDE, history: { orderBy: { changedAt: 'asc' } }, delivery: { include: { photos: true, distributor: { include: { user: true } } } } },
    });
    if (!o) throw new AppError(404, 'order_not_found', 'Order not found');
    return {
      ...this.row(o as unknown as OrderRow),
      customer: { id: o.customerId, business_name: o.customer.businessName },
      paystack_fee_kobo: Number(o.paystackFeeKobo),
      subtotal_kobo: Number(o.subtotalKobo),
      savings_kobo: Number(o.savingsKobo),
      timeline: o.history.map((h) => ({ status: h.toStatus, at: h.changedAt, note: h.note })),
      delivery: o.delivery
        ? {
            started_at: o.delivery.startedAt,
            delivered_at: o.delivery.deliveredAt,
            failed_reason: o.delivery.failedReason,
            failure_note: o.delivery.failureNote,
            photos: o.delivery.photos.map((p) => ({ key: p.storageKey, taken_at: p.takenAt })),
          }
        : null,
    };
  }

  /** Gives paid delivery orders to a distributor. All or nothing: if any order cannot be assigned, none are. */
  async assign(actorId: string, orderIds: string[], distributorId: string) {
    const ids = [...new Set(orderIds)];
    const distributor = await this.prisma.distributor.findFirst({ where: { id: distributorId, isActive: true, user: { isActive: true } } });
    if (!distributor) throw new AppError(404, 'distributor_not_found', 'Distributor not found');

    const orders = await this.prisma.order.findMany({ where: { id: { in: ids } }, include: { delivery: true } });
    const problems = ids.flatMap((id) => {
      const o = orders.find((x) => x.id === id);
      if (!o) return [{ order_id: id, reason: 'not_found' }];
      if (o.fulfilment !== 'delivery') return [{ order_id: id, order_no: o.orderNo, reason: 'pickup_order' }];
      if (o.status !== 'paid' || o.delivery) return [{ order_id: id, order_no: o.orderNo, reason: o.status === 'placed' ? 'not_paid' : 'already_assigned_or_closed' }];
      return [];
    });
    if (problems.length > 0) {
      throw new AppError(409, 'cannot_assign', 'Some orders cannot be assigned. Only paid delivery orders that are not yet assigned can be.', problems);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const id of ids) {
        await this.status.transition(tx, id, ['paid'], 'assigned', actorId, `Assigned to distributor`);
        await tx.delivery.create({ data: { orderId: id, distributorId, assignedById: actorId } });
      }
      await tx.auditLog.create({
        data: { actorUserId: actorId, action: 'order.assign', entityType: 'distributor', entityId: distributorId, after: { order_ids: ids } },
      });
    });
    await queueNotification(this.prisma, {
      userId: distributor.userId, type: 'order_status', title: 'New deliveries',
      body: ids.length === 1 ? 'You have 1 new delivery.' : `You have ${ids.length} new deliveries.`,
    });
    return { assigned: ids.length, distributor_id: distributorId };
  }

  /** Moves an order to another distributor until the first one has started the delivery. */
  async reassign(actorId: string, orderId: string, distributorId: string) {
    const distributor = await this.prisma.distributor.findFirst({ where: { id: distributorId, isActive: true, user: { isActive: true } } });
    if (!distributor) throw new AppError(404, 'distributor_not_found', 'Distributor not found');
    const delivery = await this.prisma.delivery.findUnique({ where: { orderId }, include: { order: true } });
    if (!delivery) throw new AppError(404, 'delivery_not_found', 'This order is not assigned yet');
    if (delivery.order.status !== 'assigned') {
      throw new AppError(409, 'cannot_reassign', 'Only an order that has not started delivery can be moved');
    }
    await this.prisma.$transaction([
      this.prisma.delivery.update({ where: { orderId }, data: { distributorId, assignedById: actorId, assignedAt: new Date() } }),
      this.prisma.auditLog.create({
        data: { actorUserId: actorId, action: 'order.reassign', entityType: 'order', entityId: orderId, before: { distributor_id: delivery.distributorId }, after: { distributor_id: distributorId } },
      }),
    ]);
    return { order_id: orderId, distributor_id: distributorId };
  }

  /** Pickup orders: ready at the office, then collected by the customer. */
  async markReady(actorId: string, orderId: string) {
    return this.pickupStep(actorId, orderId, 'paid', 'ready', 'Ready for pickup');
  }

  async markCollected(actorId: string, orderId: string) {
    return this.pickupStep(actorId, orderId, 'ready', 'collected', 'Collected at the office');
  }

  private async pickupStep(actorId: string, orderId: string, from: 'paid' | 'ready', to: 'ready' | 'collected', note: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new AppError(404, 'order_not_found', 'Order not found');
      if (order.fulfilment !== 'pickup') throw new AppError(409, 'not_a_pickup_order', 'This is a delivery order');
      await this.status.transition(tx, orderId, [from], to, actorId, note);
      if (to === 'collected') {
        await tx.breadStockMovement.createMany({
          data: order.items.map((i) => ({ productId: i.productId, movementType: 'delivered' as const, quantity: i.quantity, orderId, recordedById: actorId })),
        });
      }
    });
    return { id: orderId, status: to };
  }
}
