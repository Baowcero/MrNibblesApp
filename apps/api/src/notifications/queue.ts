import type { NotificationType, Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  scheduledFor?: Date;
  /** What it is about: "order:<id>", "customer:<id>" or "issue:<id>". */
  target?: string;
}

/** Writes a queued notification. Pass the transaction client to make it atomic with the change that caused it. */
export async function queueNotification(db: Db, n: NewNotification) {
  await db.notification.create({ data: { userId: n.userId, type: n.type, title: n.title, body: n.body, scheduledFor: n.scheduledFor, target: n.target } });
}

/**
 * What a customer is told at each step of the order timeline. Every step has one, so the phone
 * and the order's progress screen always agree.
 */
export const CUSTOMER_ORDER_MESSAGES: Record<string, { title: string; body: (orderNo: string, fulfilment?: string) => string }> = {
  paid: { title: 'Payment received', body: (no) => `Order ${no} is confirmed. We are baking.` },
  assigned: {
    title: 'Being arranged',
    body: (no, f) => (f === 'pickup' ? `Order ${no} is being prepared.` : `Order ${no} has been given to a distributor.`),
  },
  out_for_delivery: { title: 'On the way', body: (no) => `Order ${no} is out for delivery.` },
  delivered: { title: 'Delivered', body: (no) => `Order ${no} has been delivered. Enjoy!` },
  delivery_failed: { title: 'Delivery problem', body: (no) => `We could not deliver order ${no}. We will be in touch.` },
  ready: { title: 'Ready for pickup', body: (no) => `Order ${no} is ready at the bakery.` },
  collected: { title: 'Collected', body: (no) => `Order ${no} has been collected. Enjoy!` },
};

/** Tells every active staff member holding one of these roles. In-app only: staff have no push devices. */
export async function notifyRoles(db: Db, roles: string[], n: Omit<NewNotification, 'userId'>, exceptUserId?: string) {
  const users = await db.user.findMany({
    where: { isActive: true, ...(exceptUserId ? { id: { not: exceptUserId } } : {}), roles: { some: { role: { code: { in: roles as never } } } } },
    select: { id: true },
  });
  if (users.length === 0) return;
  await db.notification.createMany({
    data: users.map((u) => ({ userId: u.id, type: n.type, title: n.title, body: n.body, target: n.target })),
  });
}
