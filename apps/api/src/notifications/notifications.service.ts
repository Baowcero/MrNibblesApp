import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { lagosToday } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { dueReminders } from './reminders.js';
import { PushSender } from './push.js';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Notifications');
  private timers: NodeJS.Timeout[] = [];
  private busy = { dispatch: false, reminders: false };

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushSender,
  ) {}

  /**
   * Two small loops inside the API process (no separate queue server needed yet):
   * every 15 s send queued notifications, every 60 s check whether a booking reminder is due.
   * Run the API as a single instance, or move these to BullMQ when it is scaled out.
   * Set DISABLE_JOBS=1 to switch them off (tests).
   */
  onModuleInit() {
    if (process.env.DISABLE_JOBS === '1' || process.env.NODE_ENV === 'test') return;
    this.timers.push(setInterval(() => void this.guard('dispatch', () => this.dispatch()), 15_000));
    this.timers.push(setInterval(() => void this.guard('reminders', () => this.runReminders()), 60_000));
  }

  onModuleDestroy() {
    this.timers.forEach(clearInterval);
  }

  private async guard(name: 'dispatch' | 'reminders', fn: () => Promise<unknown>) {
    if (this.busy[name]) return;
    this.busy[name] = true;
    try {
      await fn();
    } catch (e) {
      this.log.error(`${name} failed: ${(e as Error).message}`);
    } finally {
      this.busy[name] = false;
    }
  }

  /** Sends queued notifications that are due. A notification is claimed first so it can never go out twice. */
  async dispatch(): Promise<number> {
    const now = new Date();
    const queued = await this.prisma.notification.findMany({
      where: { status: 'queued', OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }] },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    let sent = 0;
    for (const n of queued) {
      const claimed = await this.prisma.notification.updateMany({ where: { id: n.id, status: 'queued' }, data: { status: 'sent', sentAt: now } });
      if (claimed.count === 0) continue;
      try {
        const devices = await this.prisma.device.findMany({ where: { userId: n.userId } });
        const dead = await this.push.send(devices.map((d) => d.pushToken), n.title, n.body, { type: n.type, notification_id: n.id });
        if (dead.length) await this.prisma.device.deleteMany({ where: { pushToken: { in: dead } } });
        sent++;
      } catch (e) {
        this.log.error(`Push failed for ${n.id}: ${(e as Error).message}`);
        await this.prisma.notification.update({ where: { id: n.id }, data: { status: 'failed' } });
      }
    }
    return sent;
  }

  /**
   * Queues each due booking reminder once. The unique row in reminder_schedules is the lock,
   * so a restart or a second instance cannot send the same reminder twice.
   * Only active customers who have not ordered for that delivery date are reminded.
   */
  async runReminders(now = new Date()): Promise<number> {
    let queued = 0;
    for (const r of dueReminders(lagosToday(now), now)) {
      let row;
      try {
        row = await this.prisma.reminderSchedule.create({ data: { deliveryDate: new Date(`${r.deliveryDate}T00:00:00Z`), remindAt: r.remindAt, label: r.label } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
      const customers = await this.prisma.customer.findMany({
        where: {
          status: 'active', userId: { not: null }, user: { isActive: true },
          orders: { none: { deliveryDate: new Date(`${r.deliveryDate}T00:00:00Z`) } },
        },
        select: { userId: true },
      });
      if (customers.length) {
        await this.prisma.notification.createMany({
          data: customers.map((c) => ({ userId: c.userId!, type: 'booking_reminder' as const, title: r.title, body: r.body })),
        });
      }
      await this.prisma.reminderSchedule.update({ where: { id: row.id }, data: { enqueuedAt: new Date() } });
      queued += customers.length;
      this.log.log(`Reminder ${r.label} for ${r.deliveryDate}: ${customers.length} customer(s)`);
    }
    return queued;
  }

  // ---------------------------------------------------------------- API for the app

  async registerDevice(userId: string, platform: 'ios' | 'android', pushToken: string) {
    await this.prisma.device.upsert({
      where: { pushToken },
      update: { userId, platform, lastSeenAt: new Date() },
      create: { userId, platform, pushToken },
    });
    return { registered: true };
  }

  async removeDevice(userId: string, pushToken: string) {
    await this.prisma.device.deleteMany({ where: { userId, pushToken } });
    return { removed: true };
  }

  async list(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId, OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { data: rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, created_at: n.createdAt.toISOString() })) };
  }
}
