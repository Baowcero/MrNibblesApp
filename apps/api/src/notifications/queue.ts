import type { NotificationType, Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  scheduledFor?: Date;
}

/** Writes a queued notification. Pass the transaction client to make it atomic with the change that caused it. */
export async function queueNotification(db: Db, n: NewNotification) {
  await db.notification.create({ data: { userId: n.userId, type: n.type, title: n.title, body: n.body, scheduledFor: n.scheduledFor } });
}

/** What a customer is told when their order changes status. Statuses that are not worth a push are left out. */
export const CUSTOMER_ORDER_MESSAGES: Record<string, { title: string; body: (orderNo: string) => string }> = {
  paid: { title: 'Payment received', body: (no) => `Order ${no} is confirmed. We are baking.` },
  out_for_delivery: { title: 'On the way', body: (no) => `Order ${no} is out for delivery.` },
  delivered: { title: 'Delivered', body: (no) => `Order ${no} has been delivered. Enjoy!` },
  delivery_failed: { title: 'Delivery problem', body: (no) => `We could not deliver order ${no}. We will be in touch.` },
  ready: { title: 'Ready for pickup', body: (no) => `Order ${no} is ready at the bakery.` },
};
