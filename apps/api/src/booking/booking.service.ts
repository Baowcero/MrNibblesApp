import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { nextDelivery, type NextDelivery } from './booking-rules.js';

@Injectable()
export class BookingService {
  constructor(private readonly prisma: PrismaService) {}

  async settings(now = new Date()) {
    const row = await this.prisma.bookingSetting.findFirst({
      where: { effectiveFrom: { lte: now } },
      orderBy: { effectiveFrom: 'desc' },
    });
    return {
      cutoffTime: row?.cutoffTime ?? '08:30',
      deliveryStart: row?.deliveryStart ?? '09:00',
      deliveryEnd: row?.deliveryEnd ?? '16:00',
    };
  }

  async next(now = new Date()): Promise<NextDelivery & { deliveryStart: string; deliveryEnd: string }> {
    const s = await this.settings(now);
    return { ...nextDelivery(now, s.cutoffTime), deliveryStart: s.deliveryStart, deliveryEnd: s.deliveryEnd };
  }

  /** What the app shows on the home screen and under the countdown. */
  async status(now = new Date()) {
    const n = await this.next(now);
    return {
      server_time: now.toISOString(),
      delivery_date: n.date,
      is_same_day: n.isToday,
      closes_at: n.closesAt.toISOString(),
      seconds_until_close: Math.max(0, Math.floor((n.closesAt.getTime() - now.getTime()) / 1000)),
      delivery_window: { start: n.deliveryStart, end: n.deliveryEnd },
      message: n.isToday
        ? `Order before ${n.closesAt.toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' })} for delivery today between ${n.deliveryStart} and ${n.deliveryEnd}.`
        : `Booking for today is closed. Your order will go out on ${n.date}.`,
    };
  }
}
