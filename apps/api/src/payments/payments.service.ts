import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaystackClient, isValidSignature, type PaystackVerifyData } from './paystack.client.js';

export type SettleResult = { settled: boolean; alreadyPaid?: boolean; paystackStatus?: string };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackClient,
  ) {}

  private async myOrder(userId: string, orderId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new AppError(403, 'not_a_customer', 'This account is not a customer account');
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: customer.id },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 }, customer: { include: { user: true } } },
    });
    if (!order) throw new AppError(404, 'order_not_found', 'Order not found');
    return order;
  }

  /** Starts a Paystack checkout. The app opens `authorization_url` (card or bank transfer). */
  async initialize(userId: string, orderId: string) {
    const order = await this.myOrder(userId, orderId);
    const payment = order.payments[0];
    if (!payment || payment.method !== 'paystack') {
      throw new AppError(409, 'not_a_paystack_order', 'This order is paid in cash at the office');
    }
    if (payment.status === 'succeeded' || order.status !== 'placed') {
      throw new AppError(409, 'order_already_paid', 'This order is already paid');
    }

    // A new reference for every attempt, saved before we call Paystack so the webhook can always find it.
    const reference = `${order.orderNo}-${randomBytes(3).toString('hex')}`;
    await this.prisma.payment.update({ where: { id: payment.id }, data: { paystackReference: reference } });

    const digits = (order.customer.user?.phone ?? '').replace(/\D/g, '');
    const domain = process.env.PAYSTACK_EMAIL_DOMAIN ?? 'customers.mrnibbles.app';
    const data = await this.paystack.initialize({
      email: `${digits || order.customer.id}@${domain}`, // Paystack needs an email; customers only have a phone
      amountKobo: Number(payment.amountKobo),
      reference,
      callbackUrl: process.env.PAYSTACK_CALLBACK_URL,
      metadata: { payment_id: payment.id, order_id: order.id, order_no: order.orderNo },
    });
    return {
      authorization_url: data.authorization_url,
      access_code: data.access_code,
      reference,
      amount_kobo: Number(payment.amountKobo),
    };
  }

  /**
   * The app calls this after the customer returns from Paystack, so the order shows as paid right away
   * even if the webhook is slow. The payment is confirmed with Paystack directly, never trusted from the phone.
   */
  async verifyForCustomer(userId: string, orderId: string) {
    const order = await this.myOrder(userId, orderId);
    const payment = order.payments[0];
    if (!payment || payment.method !== 'paystack') {
      throw new AppError(409, 'not_a_paystack_order', 'This order is paid in cash at the office');
    }
    if (payment.status === 'succeeded') return { paid: true, status: 'paid' };
    if (!payment.paystackReference) {
      throw new AppError(409, 'payment_not_started', 'Start the payment first');
    }
    const result = await this.settleReference(payment.paystackReference);
    return { paid: result.settled, status: result.settled ? 'paid' : (result.paystackStatus ?? 'pending') };
  }

  // ---------------------------------------------------------------- webhook

  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    const valid = isValidSignature(rawBody, signature);
    let payload: { event?: string; data?: Record<string, unknown> };
    try {
      payload = JSON.parse(rawBody?.toString('utf8') ?? '');
    } catch {
      throw new AppError(400, 'invalid_body', 'Invalid body');
    }
    const eventType = String(payload.event ?? 'unknown');
    const data = payload.data ?? {};

    if (!valid) {
      // Saved for review, but under a random id so a fake event can never block a real one.
      await this.prisma.paystackEvent.create({
        data: { eventId: `invalid:${randomUUID()}`, eventType, payload: payload as Prisma.InputJsonValue, signatureValid: false },
      });
      throw new AppError(401, 'invalid_signature', 'Invalid signature');
    }

    const eventId = `${eventType}:${String(data.id ?? data.reference ?? randomUUID())}`;
    // Save first, process after: if processing fails the event is still on file and can be replayed.
    let event = await this.prisma.paystackEvent.findUnique({ where: { eventId } });
    if (event?.processedAt) return { received: true, duplicate: true };
    event ??= await this.prisma.paystackEvent.create({
      data: { eventId, eventType, payload: payload as Prisma.InputJsonValue, signatureValid: true },
    });

    try {
      if (eventType === 'charge.success' && typeof data.reference === 'string') {
        await this.settleReference(data.reference);
      }
      await this.prisma.paystackEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), error: null } });
      return { received: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`Paystack event ${eventId} failed: ${message}`);
      await this.prisma.paystackEvent.update({ where: { id: event.id }, data: { error: message.slice(0, 500) } });
      throw e; // a non-200 makes Paystack send the event again
    }
  }

  /** Confirms a reference with Paystack, checks the amount, then marks the order paid. Safe to repeat. */
  async settleReference(reference: string): Promise<SettleResult> {
    const verified: PaystackVerifyData = await this.paystack.verify(reference);
    if (verified.status !== 'success') return { settled: false, paystackStatus: verified.status };

    const payment =
      (await this.prisma.payment.findUnique({ where: { paystackReference: reference } })) ??
      (verified.metadata?.payment_id
        ? await this.prisma.payment.findUnique({ where: { id: verified.metadata.payment_id } })
        : null);
    if (!payment) throw new AppError(404, 'payment_not_found', `No payment found for reference ${reference}`);
    if (payment.method !== 'paystack') throw new AppError(409, 'wrong_payment_method', 'Not a Paystack payment');
    if (verified.currency !== 'NGN' || BigInt(verified.amount) !== payment.amountKobo) {
      throw new AppError(409, 'amount_mismatch', `Paystack paid ${verified.amount} but the order expects ${payment.amountKobo}`);
    }
    const result = await this.markPaid(payment.id, { reference });
    return { settled: true, alreadyPaid: result.alreadyPaid };
  }

  // ---------------------------------------------------------------- cash at the office

  async recordCash(actorId: string, orderNo: string, note?: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNo },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw new AppError(404, 'order_not_found', 'Order not found');
    const payment = order.payments[0];
    if (!payment) throw new AppError(409, 'no_payment', 'This order has no payment record');
    if (payment.method !== 'office_cash') {
      throw new AppError(409, 'wrong_payment_method', 'This order was set up for Paystack (the fee is included), so it cannot be paid in cash');
    }
    const result = await this.markPaid(payment.id, { receivedById: actorId, note });
    if (result.alreadyPaid) throw new AppError(409, 'order_already_paid', 'This order is already paid');
    return { order_no: order.orderNo, status: 'paid', total_kobo: Number(order.totalKobo) };
  }

  // ---------------------------------------------------------------- shared

  /**
   * Marks a payment succeeded and moves the order to paid, in one transaction:
   * payment ledger rows, savings, status history and (for cash) the receipt.
   * Running it twice does nothing the second time.
   */
  async markPaid(paymentId: string, opts: { reference?: string; receivedById?: string; note?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
      if (payment.status === 'succeeded') return { alreadyPaid: true };
      if (payment.status !== 'pending') {
        throw new AppError(409, 'payment_not_pending', `Payment is ${payment.status}`);
      }
      const { order } = payment;

      // One payment at a time per customer, so the savings balance cannot be calculated twice from the same start.
      await tx.$queryRaw`SELECT id FROM customers WHERE id = ${order.customerId}::uuid FOR UPDATE`;

      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, status: 'pending' },
        data: {
          status: 'succeeded',
          paidAt: new Date(),
          ...(opts.reference ? { paystackReference: opts.reference } : {}),
          ...(opts.receivedById ? { recordedById: opts.receivedById } : {}),
        },
      });
      if (claimed.count === 0) return { alreadyPaid: true };

      if (order.status === 'placed') {
        await tx.order.update({ where: { id: order.id }, data: { status: 'paid' } });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: 'placed',
            toStatus: 'paid',
            changedById: opts.receivedById ?? null,
            note: payment.method === 'paystack' ? 'Paid with Paystack' : 'Paid in cash at the office',
          },
        });
      }

      await tx.paymentLedger.create({
        data: { paymentId, orderId: order.id, entryType: 'charge', amountKobo: order.subtotalKobo, balanceAfterKobo: order.subtotalKobo },
      });
      if (order.paystackFeeKobo > 0n) {
        await tx.paymentLedger.create({
          data: { paymentId, orderId: order.id, entryType: 'fee', amountKobo: order.paystackFeeKobo, balanceAfterKobo: order.totalKobo },
        });
      }

      if (order.savingsKobo > 0n) {
        const last = await tx.savingsLedger.findFirst({
          where: { customerId: order.customerId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        await tx.savingsLedger.create({
          data: {
            customerId: order.customerId,
            orderId: order.id,
            entryType: 'earned',
            amountKobo: order.savingsKobo,
            balanceAfterKobo: (last?.balanceAfterKobo ?? 0n) + order.savingsKobo,
          },
        });
      }

      if (payment.method === 'office_cash' && opts.receivedById) {
        await tx.cashReceipt.create({ data: { paymentId, receivedById: opts.receivedById, note: opts.note } });
        await tx.auditLog.create({
          data: {
            actorUserId: opts.receivedById,
            action: 'payment.cash_recorded',
            entityType: 'order',
            entityId: order.id,
            after: { order_no: order.orderNo, amount_kobo: Number(order.totalKobo) },
          },
        });
      }
      return { alreadyPaid: false };
    });
  }
}
