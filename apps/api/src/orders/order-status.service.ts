import { Global, Injectable, Module } from '@nestjs/common';
import type { OrderStatus, Prisma } from '@prisma/client';
import { AppError } from '../common/app-error.js';
import { CUSTOMER_ORDER_MESSAGES, queueNotification } from '../notifications/queue.js';

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
    const message = CUSTOMER_ORDER_MESSAGES[to];
    if (message) {
      const customer = await tx.customer.findUnique({ where: { id: order.customerId } });
      if (customer?.userId) {
        await queueNotification(tx, { userId: customer.userId, type: 'order_status', title: message.title, body: message.body(order.orderNo) });
      }
    }
    return order;
  }
}

@Global()
@Module({ providers: [OrderStatusService], exports: [OrderStatusService] })
export class OrderStatusModule {}
