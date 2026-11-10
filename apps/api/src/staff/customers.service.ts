import { Injectable } from '@nestjs/common';
import type { CustomerStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListCustomersDto } from './customers.dto.js';

@Injectable()
export class StaffCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(dto: ListCustomersDto) {
    const limit = dto.limit ?? 50;
    const where: Prisma.CustomerWhereInput = {};
    if (dto.status) where.status = dto.status;
    if (dto.q) where.businessName = { contains: dto.q.trim(), mode: 'insensitive' };
    const rows = await this.prisma.customer.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      include: {
        user: { select: { fullName: true, phone: true } },
        locations: { where: { isDefault: true, isActive: true }, include: { area: true }, take: 1 },
      },
    });
    const page = rows.slice(0, limit);
    return {
      data: page.map((c) => ({
        id: c.id,
        business_name: c.businessName,
        status: c.status,
        source: c.source,
        contact_name: c.user?.fullName ?? null,
        phone: c.user?.phone ?? null,
        address: c.locations[0]?.address ?? null,
        area: c.locations[0]?.area.name ?? null,
        claimed_at: c.claimedAt,
        approved_at: c.approvedAt,
        rejection_note: c.rejectionNote,
      })),
      next_cursor: rows.length > limit ? page[page.length - 1]!.id : null,
    };
  }

  approve(id: string, actorId: string, ip?: string) {
    return this.transition(id, actorId, ['pending_approval', 'rejected', 'suspended'], 'active', 'customer.approve', {}, ip);
  }

  reject(id: string, actorId: string, note: string, ip?: string) {
    return this.transition(id, actorId, ['pending_approval'], 'rejected', 'customer.reject', { rejectionNote: note }, ip);
  }

  suspend(id: string, actorId: string, ip?: string) {
    return this.transition(id, actorId, ['active'], 'suspended', 'customer.suspend', {}, ip);
  }

  private async transition(
    id: string,
    actorId: string,
    from: CustomerStatus[],
    to: CustomerStatus,
    action: string,
    extra: Prisma.CustomerUncheckedUpdateManyInput,
    ip?: string,
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new AppError(404, 'customer_not_found', 'Customer not found');
    if (!customer.userId) {
      throw new AppError(409, 'customer_not_claimed', 'This customer has not signed up yet');
    }
    if (!from.includes(customer.status)) {
      throw new AppError(409, 'invalid_status_transition', `A customer who is ${customer.status} cannot be set to ${to}`);
    }

    const data: Prisma.CustomerUncheckedUpdateManyInput =
      to === 'active'
        ? { status: to, approvedAt: new Date(), approvedById: actorId, rejectionNote: null }
        : { status: to, ...extra };

    // The extra status condition makes this safe if two staff act at the same moment.
    const result = await this.prisma.customer.updateMany({ where: { id, status: customer.status }, data });
    if (result.count === 0) {
      throw new AppError(409, 'invalid_status_transition', 'This customer was just changed by someone else. Refresh and try again.');
    }

    await this.audit.log({
      actorUserId: actorId,
      action,
      entityType: 'customer',
      entityId: id,
      before: { status: customer.status },
      after: { status: to, ...(extra.rejectionNote ? { note: String(extra.rejectionNote) } : {}) },
      ip,
    });
    // TODO(notifications module): push the customer when approved or rejected.
    return { id, status: to };
  }
}
