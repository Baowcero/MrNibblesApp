import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { AppError } from '../common/app-error.js';
import { SAVINGS_PER_BREAD_KOBO, paystackFeeKobo } from '../common/money.js';
import { BookingService } from '../booking/booking.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateOrderDto, ListOrdersDto, QuoteDto } from './dto.js';

const ORDER_NO_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I/L)

function newOrderNo(date: string): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += ORDER_NO_ALPHABET[randomInt(ORDER_NO_ALPHABET.length)];
  return `MN-${date.slice(2).replaceAll('-', '')}-${suffix}`;
}

const DETAIL_INCLUDE = {
  items: { include: { product: true } },
  location: { include: { area: true } },
  history: { orderBy: { changedAt: 'asc' } },
  payments: { orderBy: { createdAt: 'desc' }, take: 1 },
} as const;
type OrderDetail = Prisma.OrderGetPayload<{ include: typeof DETAIL_INCLUDE }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly booking: BookingService,
    private readonly catalog: CatalogService,
  ) {}

  private async customerFor(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new AppError(403, 'not_a_customer', 'This account is not a customer account');
    return customer;
  }

  /** Prices the cart with today's prices and the fee for the chosen payment method. */
  private async price(dto: QuoteDto) {
    const products = await this.catalog.currentProducts();
    const byId = new Map(products.map((p) => [p.id, p]));

    // The same product twice in one order is added together.
    const qty = new Map<string, number>();
    for (const item of dto.items) qty.set(item.product_id, (qty.get(item.product_id) ?? 0) + item.quantity);

    const lines = [...qty.entries()].map(([productId, quantity]) => {
      const product = byId.get(productId);
      if (!product) throw new AppError(400, 'product_unavailable', 'One of the products is not available');
      return {
        product,
        quantity,
        unitPriceKobo: product.unitPriceKobo,
        lineTotalKobo: product.unitPriceKobo * BigInt(quantity),
      };
    });

    const subtotal = lines.reduce((sum, l) => sum + l.lineTotalKobo, 0n);
    const fee = dto.payment_method === 'paystack' ? paystackFeeKobo(subtotal) : 0n;
    const totalBread = lines.reduce((sum, l) => sum + l.quantity, 0);
    return { lines, subtotal, fee, total: subtotal + fee, savings: SAVINGS_PER_BREAD_KOBO * BigInt(totalBread) };
  }

  async quote(dto: QuoteDto) {
    const [priced, next] = await Promise.all([this.price(dto), this.booking.next()]);
    return {
      delivery_date: next.date,
      is_same_day: next.isToday,
      closes_at: next.closesAt.toISOString(),
      items: priced.lines.map((l) => ({
        product_id: l.product.id,
        name: l.product.name,
        quantity: l.quantity,
        unit_price_kobo: Number(l.unitPriceKobo),
        line_total_kobo: Number(l.lineTotalKobo),
      })),
      subtotal_kobo: Number(priced.subtotal),
      paystack_fee_kobo: Number(priced.fee),
      total_kobo: Number(priced.total),
      savings_kobo: Number(priced.savings),
    };
  }

  async create(userId: string, dto: CreateOrderDto, idempotencyKey: string) {
    const customer = await this.customerFor(userId);
    if (customer.status !== 'active') {
      throw new AppError(
        403,
        'customer_not_approved',
        customer.status === 'pending_approval'
          ? 'Your account is waiting for approval by Mr Nibbles. You can order once it is approved.'
          : 'Your account cannot place orders right now. Contact Mr Nibbles.',
      );
    }

    // A retry of the same request returns the order that was already created.
    const paymentKey = `${customer.id}:${idempotencyKey}`;
    const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey: paymentKey } });
    if (existing) return { ...(await this.detail(userId, existing.orderId)), replayed: true };

    let locationId: string | null = null;
    if (dto.fulfilment === 'delivery') {
      if (!dto.location_id) throw new AppError(400, 'location_required', 'Choose where to deliver');
      const location = await this.prisma.customerLocation.findFirst({
        where: { id: dto.location_id, customerId: customer.id, isActive: true },
      });
      if (!location) throw new AppError(400, 'invalid_location', 'Choose one of your saved delivery locations');
      locationId = location.id;
    }

    const priced = await this.price(dto);
    const next = await this.booking.next();

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const order = await this.prisma.$transaction(async (tx) => {
          const created = await tx.order.create({
            data: {
              orderNo: newOrderNo(next.date),
              customerId: customer.id,
              locationId,
              fulfilment: dto.fulfilment,
              deliveryDate: new Date(`${next.date}T00:00:00Z`),
              status: 'placed',
              subtotalKobo: priced.subtotal,
              paystackFeeKobo: priced.fee,
              totalKobo: priced.total,
              savingsKobo: priced.savings,
              createdById: userId,
              items: {
                create: priced.lines.map((l) => ({
                  productId: l.product.id,
                  quantity: l.quantity,
                  unitPriceKobo: l.unitPriceKobo,
                  lineTotalKobo: l.lineTotalKobo,
                })),
              },
            },
          });
          await tx.orderStatusHistory.create({
            data: { orderId: created.id, fromStatus: null, toStatus: 'placed', changedById: userId },
          });
          // Pending payment: Paystack confirms it by webhook, or accounts record the cash.
          await tx.payment.create({
            data: {
              orderId: created.id,
              method: dto.payment_method,
              status: 'pending',
              amountKobo: priced.total,
              feeKobo: priced.fee,
              idempotencyKey: paymentKey,
            },
          });
          return created;
        });
        return this.detail(userId, order.id);
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          // Same request sent twice at the same moment: return the first one.
          const again = await this.prisma.payment.findUnique({ where: { idempotencyKey: paymentKey } });
          if (again) return { ...(await this.detail(userId, again.orderId)), replayed: true };
          continue; // order number clash: try another one
        }
        throw e;
      }
    }
    throw new AppError(500, 'order_number_failed', 'Could not create the order. Please try again.');
  }

  async list(userId: string, dto: ListOrdersDto) {
    const customer = await this.customerFor(userId);
    const limit = dto.limit ?? 20;
    const rows = await this.prisma.order.findMany({
      where: { customerId: customer.id },
      orderBy: [{ placedAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      include: { items: true },
    });
    const page = rows.slice(0, limit);
    return {
      data: page.map((o) => ({
        id: o.id,
        order_no: o.orderNo,
        status: o.status,
        fulfilment: o.fulfilment,
        delivery_date: o.deliveryDate.toISOString().slice(0, 10),
        total_kobo: Number(o.totalKobo),
        bread_count: o.items.reduce((n, i) => n + i.quantity, 0),
        placed_at: o.placedAt,
      })),
      next_cursor: rows.length > limit ? page[page.length - 1]!.id : null,
    };
  }

  async detail(userId: string, orderId: string) {
    const customer = await this.customerFor(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: customer.id },
      include: DETAIL_INCLUDE,
    });
    if (!order) throw new AppError(404, 'order_not_found', 'Order not found');
    return this.present(order);
  }

  private present(o: OrderDetail) {
    const payment = o.payments[0];
    return {
      id: o.id,
      order_no: o.orderNo,
      status: o.status,
      fulfilment: o.fulfilment,
      delivery_date: o.deliveryDate.toISOString().slice(0, 10),
      location: o.location
        ? { id: o.location.id, label: o.location.label, address: o.location.address, area: o.location.area.name }
        : null,
      items: o.items.map((i) => ({
        product_id: i.productId,
        name: i.product.name,
        quantity: i.quantity,
        unit_price_kobo: Number(i.unitPriceKobo),
        line_total_kobo: Number(i.lineTotalKobo),
      })),
      subtotal_kobo: Number(o.subtotalKobo),
      paystack_fee_kobo: Number(o.paystackFeeKobo),
      total_kobo: Number(o.totalKobo),
      savings_kobo: Number(o.savingsKobo),
      payment: payment ? { method: payment.method, status: payment.status } : null,
      timeline: o.history.map((h) => ({ status: h.toStatus, at: h.changedAt, note: h.note })),
      placed_at: o.placedAt,
    };
  }
}
