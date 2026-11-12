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

/** Tells every active staff member holding one of these roles. In-app only: staff have no push devices. */
export async function notifyRoles(db: Db, roles: string[], n: Omit<NewNotification, 'userId'>) {
  const users = await db.user.findMany({
    where: { isActive: true, roles: { some: { role: { code: { in: roles as never } } } } },
    select: { id: true },
  });
  if (users.length === 0) return;
  await db.notification.createMany({
    data: users.map((u) => ({ userId: u.id, type: n.type, title: n.title, body: n.body })),
  });
}
