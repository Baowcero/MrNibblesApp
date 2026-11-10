import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError } from '../common/app-error.js';
import { lagosToday, toDateOnly } from '../common/dates.js';
import { OrderStatusService } from '../orders/order-status.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService, parsePhotoKey } from '../storage/storage.service.js';
import type { ConfirmDeliveryDto, FailDeliveryDto } from './dto.js';

const DELIVERY_INCLUDE = {
  order: {
    include: {
      customer: { include: { user: true } },
      location: { include: { area: true } },
      items: { include: { product: true } },
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  },
  photos: true,
} as const;
type DeliveryRow = Prisma.DeliveryGetPayload<{ include: typeof DELIVERY_INCLUDE }>;

@Injectable()
export class DistributorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: OrderStatusService,
    private readonly storage: StorageService,
  ) {}

  async me(userId: string) {
    const d = await this.prisma.distributor.findFirst({ where: { userId, isActive: true } });
    if (!d) throw new AppError(403, 'not_a_distributor', 'This account is not an active distributor');
    return d;
  }

  private present(d: DeliveryRow) {
    const o = d.order;
    const pay = o.payments[0];
    return {
      id: d.id,
      order_id: o.id,
      order_no: o.orderNo,
      status: o.status,
      delivery_date: o.deliveryDate.toISOString().slice(0, 10),
      business_name: o.customer.businessName,
      contact_name: o.customer.user?.fullName ?? null,
      phone: o.customer.user?.phone ?? null,
      address: o.location?.address ?? null,
      location_label: o.location?.label ?? null,
      area: o.location?.area.name ?? null,
      items: o.items.map((i) => ({ name: i.product.name, quantity: i.quantity })),
      bread_count: o.items.reduce((n, i) => n + i.quantity, 0),
      payment_status: pay?.status ?? null, // always paid before it is assigned: no money is collected on delivery
      started_at: d.startedAt,
      delivered_at: d.deliveredAt,
      failed_reason: d.failedReason,
      photo_count: d.photos.length,
    };
  }

  private async own(userId: string, deliveryId: string) {
    const me = await this.me(userId);
    const delivery = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, distributorId: me.id },
      include: DELIVERY_INCLUDE,
    });
    if (!delivery) throw new AppError(404, 'delivery_not_found', 'Delivery not found');
    return { me, delivery };
  }

  async list(userId: string, date?: string) {
    const me = await this.me(userId);
    const rows = await this.prisma.delivery.findMany({
      where: { distributorId: me.id, order: { deliveryDate: toDateOnly(date ?? lagosToday()) } },
      include: DELIVERY_INCLUDE,
    });
    const data = rows.map((r) => this.present(r)).sort((a, b) => (a.area ?? '').localeCompare(b.area ?? '') || a.business_name.localeCompare(b.business_name));
    return { data };
  }

  async detail(userId: string, deliveryId: string) {
    return this.present((await this.own(userId, deliveryId)).delivery);
  }

  async start(userId: string, deliveryId: string) {
    const { delivery } = await this.own(userId, deliveryId);
    if (delivery.order.status === 'out_for_delivery') return this.present(delivery); // already started
    await this.prisma.$transaction(async (tx) => {
      await this.status.transition(tx, delivery.orderId, ['assigned'], 'out_for_delivery', userId, 'Distributor is on the way');
      await tx.delivery.update({ where: { id: delivery.id }, data: { startedAt: new Date() } });
    });
    return this.detail(userId, deliveryId);
  }

  /** Photo proof is mandatory. The same request sent twice (a retry on a bad network) changes nothing. */
  async confirm(userId: string, deliveryId: string, dto: ConfirmDeliveryDto) {
    const { me, delivery } = await this.own(userId, deliveryId);
    if (delivery.order.status === 'delivered') return this.present(delivery);

    const keys = [...new Set(dto.photo_keys)];
    for (const key of keys) {
      const parsed = parsePhotoKey(key);
      if (!parsed || parsed.distributorId !== me.id) throw new AppError(400, 'invalid_photo', 'One of the photos is not valid. Take the photo again.');
      if (!(await this.storage.exists(key))) throw new AppError(400, 'photo_not_uploaded', 'A photo has not finished uploading yet');
    }

    await this.prisma.$transaction(async (tx) => {
      // Photos first: the database refuses "delivered" without at least one photo.
      await tx.deliveryPhoto.createMany({
        data: keys.map((storageKey) => ({
          deliveryId: delivery.id,
          storageKey,
          takenAt: dto.taken_at ? new Date(dto.taken_at) : new Date(),
          latitude: dto.latitude,
          longitude: dto.longitude,
        })),
      });
      await this.status.transition(tx, delivery.orderId, ['assigned', 'out_for_delivery'], 'delivered', userId, 'Delivered with photo');
      await tx.delivery.update({
        where: { id: delivery.id },
        data: { deliveredAt: new Date(), startedAt: delivery.startedAt ?? new Date() },
      });
      await tx.breadStockMovement.createMany({
        data: delivery.order.items.map((i) => ({
          productId: i.productId,
          movementType: 'delivered' as const,
          quantity: i.quantity,
          orderId: delivery.orderId,
          recordedById: userId,
        })),
      });
    });
    return this.detail(userId, deliveryId);
  }

  /** The bread comes back and goes to the salesperson. There are no refunds. */
  async fail(userId: string, deliveryId: string, dto: FailDeliveryDto) {
    const { delivery } = await this.own(userId, deliveryId);
    if (delivery.order.status === 'delivery_failed') return this.present(delivery);
    await this.prisma.$transaction(async (tx) => {
      await this.status.transition(tx, delivery.orderId, ['assigned', 'out_for_delivery'], 'delivery_failed', userId, dto.note ?? dto.reason);
      await tx.delivery.update({ where: { id: delivery.id }, data: { failedReason: dto.reason, failureNote: dto.note } });
      await tx.breadStockMovement.createMany({
        data: delivery.order.items.map((i) => ({
          productId: i.productId,
          movementType: 'returned' as const,
          quantity: i.quantity,
          orderId: delivery.orderId,
          recordedById: userId,
        })),
      });
    });
    return this.detail(userId, deliveryId);
  }

  async summary(userId: string, date?: string) {
    const { data } = await this.list(userId, date);
    const sum = (rows: typeof data) => rows.reduce((n, r) => n + r.bread_count, 0);
    const delivered = data.filter((d) => d.status === 'delivered');
    const failed = data.filter((d) => d.status === 'delivery_failed');
    return {
      date: date ?? lagosToday(),
      total: data.length,
      delivered: delivered.length,
      failed: failed.length,
      pending: data.length - delivered.length - failed.length,
      bread_delivered: sum(delivered),
      bread_returned: sum(failed),
    };
  }
}
