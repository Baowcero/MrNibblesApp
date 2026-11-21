import { Global, Injectable, Module } from '@nestjs/common';
import type { OrderStatus, Prisma } from '@prisma/client';
import { AppError } from '../common/app-error.js';
import { CUSTOMER_ORDER_MESSAGES, notifyRoles, queueNotification } from '../notifications/queue.js';

/** The one place an order's status changes, so every change is checked and written to the history. */
@Injectable()
export class OrderStatusService {
  async transition(
    tx: Prisma.TransactionClient,
    orderId: string,
    from: OrderStatus[],
    to: OrderStatus,
    actorId: string | null,
    note?: string,
  ) {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError(404, 'order_not_found', 'Order not found');
    if (!from.includes(order.status)) {
      throw new AppError(409, 'invalid_status_transition', `Order ${order.orderNo} is ${order.status} and cannot become ${to}`);
    }
    const changed = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: to } });
    if (changed.count === 0) {
      throw new AppError(409, 'invalid_status_transition', `Order ${order.orderNo} was just changed. Refresh and try again.`);
    }
    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: order.status, toStatus: to, changedById: actorId, note },
    });
    // Staff hear about the moments that matter: money in, bread delivered or collected, a delivery that failed.
    const staff: Partial<Record<OrderStatus, { roles: string[]; title: string; body: (who: string) => string }>> = {
      paid: {
        roles: ['sales', 'ceo', 'accounts'],
        title: 'Payment received',
        body: (who) => `${order.orderNo} · ${who} is paid${order.fulfilment === 'delivery' ? ' and ready to assign.' : '.'}`,
      },
      delivered: { roles: ['sales', 'ceo'], title: 'Delivered', body: (who) => `${order.orderNo} · ${who} was delivered.` },
      collected: { roles: ['sales', 'ceo'], title: 'Collected', body: (who) => `${order.orderNo} · ${who} collected their order.` },
      delivery_failed: { roles: ['sales', 'ceo'], title: 'Delivery failed', body: (who) => `${order.orderNo} · ${who} could not be delivered.` },
    };
    const forStaff = staff[to];
    if (forStaff) {
      const biz = await tx.customer.findUnique({ where: { id: order.customerId }, select: { businessName: true } });
      await notifyRoles(tx, forStaff.roles, {
        type: 'order_status',
        title: forStaff.title,
        body: forStaff.body(biz?.businessName ?? 'Customer'),
        target: `order:${order.id}`,
      });
    }
    const message = CUSTOMER_ORDER_MESSAGES[to];
    if (message) {
      const customer = await tx.customer.findUnique({ where: { id: order.customerId } });
      if (customer?.userId) {
        await queueNotification(tx, { userId: customer.userId, type: 'order_status', title: message.title, body: message.body(order.orderNo, order.fulfilment), target: `order:${order.id}` });
      }
    }
    return order;
  }
}

@Global()
@Module({ providers: [OrderStatusService], exports: [OrderStatusService] })
export class OrderStatusModule {}
