import { Injectable } from '@nestjs/common';
import { Prisma, RoleCode } from '@prisma/client';
import { AppError } from '../common/app-error.js';
import type { AuthUser } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parsePhotoKey } from '../storage/storage.service.js';
import type { ReportIssueDto } from './dto.js';

const STAFF: RoleCode[] = ['ceo', 'sales', 'accounts'];
const NEEDS_QTY = ['missing', 'damaged', 'wrong_quantity'];

const INCLUDE = { order: { include: { customer: true } }, photos: true, reportedBy: true } as const;
type Row = Prisma.OrderIssueGetPayload<{ include: typeof INCLUDE }>;

export const presentIssue = (i: Row) => ({
  id: i.id,
  order_id: i.orderId,
  order_no: i.order.orderNo,
  business_name: i.order.customer.businessName,
  issue_type: i.issueType,
  quantity: i.quantity,
  note: i.note,
  status: i.status,
  reporter_role: i.reporterRole,
  reported_by: i.reportedBy.fullName,
  photo_keys: i.photos.map((p) => p.storageKey),
  created_at: i.createdAt.toISOString(),
  settled_at: i.settledAt?.toISOString() ?? null,
});

@Injectable()
export class IssuesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Customers report on their own orders, distributors on orders assigned to them, staff on any order. */
  async report(user: AuthUser, orderId: string, dto: ReportIssueDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { customer: true, delivery: { include: { distributor: true } } } });
    if (!order) throw new AppError(404, 'order_not_found', 'Order not found');

    let role: RoleCode;
    let photoOwner: string | null = null;
    if (user.roles.some((r) => STAFF.includes(r))) {
      role = STAFF.find((r) => user.roles.includes(r))!;
    } else if (user.roles.includes('distributor')) {
      if (order.delivery?.distributor.userId !== user.id) throw new AppError(403, 'not_your_order', 'This order is not assigned to you');
      role = 'distributor';
      photoOwner = order.delivery.distributorId;
    } else if (user.roles.includes('customer')) {
      if (order.customer.userId !== user.id) throw new AppError(404, 'order_not_found', 'Order not found');
      if (!['out_for_delivery', 'delivered', 'delivery_failed', 'ready', 'collected'].includes(order.status)) {
        throw new AppError(409, 'too_early', 'You can report a problem once your order is on its way or delivered');
      }
      role = 'customer';
    } else {
      throw new AppError(403, 'forbidden', 'You cannot report order issues');
    }

    if (NEEDS_QTY.includes(dto.issue_type) && !dto.quantity) throw new AppError(400, 'quantity_required', 'Say how many loaves are affected');
    if (dto.issue_type === 'other' && !dto.note) throw new AppError(400, 'note_required', 'Describe the problem');

    const keys = dto.photo_keys ?? [];
    for (const k of keys) {
      const parsed = parsePhotoKey(k);
      if (!parsed || !photoOwner || parsed.distributorId !== photoOwner) throw new AppError(400, 'invalid_photo', 'Photos can only be attached by the assigned distributor, from their own uploads');
    }

    if (dto.client_event_id) {
      const existing = await this.prisma.orderIssue.findUnique({ where: { clientEventId: dto.client_event_id }, include: INCLUDE });
      if (existing) return presentIssue(existing);
    }

    try {
      const created = await this.prisma.orderIssue.create({
        data: {
          orderId, deliveryId: order.delivery?.id ?? null, reportedById: user.id, reporterRole: role,
          issueType: dto.issue_type, quantity: dto.quantity, note: dto.note, clientEventId: dto.client_event_id,
          photos: { create: keys.map((storageKey) => ({ storageKey })) },
        },
        include: INCLUDE,
      });
      return presentIssue(created);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && dto.client_event_id) {
        const existing = await this.prisma.orderIssue.findUnique({ where: { clientEventId: dto.client_event_id }, include: INCLUDE });
        if (existing) return presentIssue(existing);
      }
      throw e;
    }
  }

  async forCustomerOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, customer: { userId } } });
    if (!order) throw new AppError(404, 'order_not_found', 'Order not found');
    const rows = await this.prisma.orderIssue.findMany({ where: { orderId }, include: INCLUDE, orderBy: { createdAt: 'desc' } });
    return { data: rows.map(presentIssue) };
  }

  async list(status?: 'open' | 'settled') {
    const rows = await this.prisma.orderIssue.findMany({
      where: status ? { status } : {}, include: INCLUDE, orderBy: { createdAt: 'desc' }, take: 200,
    });
    return { data: rows.map(presentIssue) };
  }
}
