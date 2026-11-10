import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import { isFuture, lagosDayRange, lagosToday, toDateOnly } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AddItemDto, CloseDayDto, SettleIssueDto } from './dto.js';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Opens the day's reconciliation, or returns the one already open for that date. */
  async open(actorId: string, date?: string) {
    const d = date ?? lagosToday();
    if (isFuture(d)) throw new AppError(400, 'future_date', 'You cannot reconcile a future day');
    const existing = await this.prisma.dailyReconciliation.findUnique({ where: { reconDate: toDateOnly(d) } });
    if (existing) return { id: existing.id, date: d, status: existing.status };
    try {
      const r = await this.prisma.dailyReconciliation.create({ data: { reconDate: toDateOnly(d), openedById: actorId } });
      return { id: r.id, date: d, status: r.status };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const again = await this.prisma.dailyReconciliation.findUniqueOrThrow({ where: { reconDate: toDateOnly(d) } });
        return { id: again.id, date: d, status: again.status };
      }
      throw e;
    }
  }

  private async get(id: string) {
    const r = await this.prisma.dailyReconciliation.findUnique({ where: { id } });
    if (!r) throw new AppError(404, 'reconciliation_not_found', 'Reconciliation not found');
    return r;
  }

  private assertOpen(r: { status: string }) {
    if (r.status !== 'open') throw new AppError(409, 'day_closed', 'This day is already closed');
  }

  /**
   * The picture for one day: orders by outcome, money by method, payments still unpaid on delivered orders,
   * the items already logged, and every issue still open (issues carry over until settled).
   */
  async view(date?: string) {
    const d = date ?? lagosToday();
    const recon = await this.prisma.dailyReconciliation.findUnique({
      where: { reconDate: toDateOnly(d) },
      include: { items: { include: { order: true } } },
    });

    const orders = await this.prisma.order.findMany({
      where: { deliveryDate: toDateOnly(d), status: { not: 'cancelled' } },
      include: { customer: true, payments: true, items: true },
    });
    const byStatus: Record<string, number> = {};
    let loaves = 0;
    let deliveredLoaves = 0;
    const paid = { paystack: 0, office_cash: 0 } as Record<string, number>;
    const unpaid: { order_id: string; order_no: string; business_name: string; total_kobo: number; method: string | null }[] = [];

    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      const qty = o.items.reduce((s, i) => s + i.quantity, 0);
      loaves += qty;
      const success = o.payments.find((p) => p.status === 'paid');
      if (success) paid[success.method] = (paid[success.method] ?? 0) + Number(success.amountKobo);
      if (['delivered', 'collected'].includes(o.status)) {
        deliveredLoaves += qty;
        if (!success) {
          unpaid.push({ order_id: o.id, order_no: o.orderNo, business_name: o.customer.businessName, total_kobo: Number(o.totalKobo), method: o.payments[0]?.method ?? null });
        }
      }
    }

    const openIssues = await this.prisma.orderIssue.findMany({
      where: { status: 'open' },
      include: { order: { include: { customer: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const bread = await this.prisma.breadStockMovement.groupBy({ by: ['movementType'], where: { createdAt: lagosDayRange(d) }, _sum: { quantity: true } });
    const breadSum = (t: string) => bread.find((b) => b.movementType === t)?._sum.quantity ?? 0;

    return {
      date: d,
      reconciliation: recon ? { id: recon.id, status: recon.status, closed_at: recon.closedAt?.toISOString() ?? null, note: recon.note } : null,
      orders: { total: orders.length, by_status: byStatus, loaves_ordered: loaves, loaves_delivered: deliveredLoaves },
      money_paid_kobo: paid,
      delivered_but_unpaid: unpaid,
      bread: { produced: breadSum('produced'), returned: breadSum('returned'), leftover_to_sales: breadSum('leftover_to_sales') },
      items: (recon?.items ?? []).map((i) => ({
        id: i.id, item_type: i.itemType, order_no: i.order?.orderNo ?? null, issue_id: i.issueId, quantity: i.quantity,
        amount_kobo: i.amountKobo != null ? Number(i.amountKobo) : null, resolution: i.resolution, note: i.note,
      })),
      open_issues: openIssues.map((i) => ({
        id: i.id, order_no: i.order.orderNo, business_name: i.order.customer.businessName, issue_type: i.issueType,
        quantity: i.quantity, note: i.note, reported: ymd(i.createdAt),
      })),
    };
  }

  /** A return or payment mismatch found while reconciling. A return also puts the bread back into the stock ledger. */
  async addItem(actorId: string, id: string, dto: AddItemDto) {
    const recon = await this.get(id);
    this.assertOpen(recon);
    const order = await this.prisma.order.findUnique({ where: { id: dto.order_id } });
    if (!order) throw new AppError(404, 'order_not_found', 'Order not found');
    if (dto.item_type === 'return' && !dto.quantity) throw new AppError(400, 'quantity_required', 'Say how many loaves came back');
    if (dto.item_type === 'payment_mismatch' && !dto.amount_kobo) throw new AppError(400, 'amount_required', 'Enter the amount that does not match');

    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reconciliationItem.create({
        data: {
          reconciliationId: id, orderId: dto.order_id, itemType: dto.item_type, quantity: dto.quantity,
          amountKobo: dto.amount_kobo != null ? BigInt(dto.amount_kobo) : null, resolution: dto.resolution, note: dto.note,
        },
      });
      if (dto.item_type === 'return') {
        // Returned loaves are attributed to the order's first line when we cannot tell which product came back.
        const line = await tx.orderItem.findFirst({ where: { orderId: dto.order_id }, orderBy: { id: 'asc' } });
        if (line) {
          await tx.breadStockMovement.create({
            data: { productId: line.productId, movementType: 'returned', quantity: dto.quantity!, orderId: dto.order_id, recordedById: actorId },
          });
        }
      }
      return created;
    });
    await this.audit.log({ actorUserId: actorId, action: `reconciliation.${dto.item_type}`, entityType: 'order', entityId: dto.order_id, after: { quantity: dto.quantity, amount_kobo: dto.amount_kobo, resolution: dto.resolution } });
    return { id: item.id };
  }

  /** Settles an issue inside the day's reconciliation and logs it as an item. */
  async settleIssue(actorId: string, id: string, issueId: string, dto: SettleIssueDto) {
    const recon = await this.get(id);
    this.assertOpen(recon);
    const issue = await this.prisma.orderIssue.findUnique({ where: { id: issueId } });
    if (!issue) throw new AppError(404, 'issue_not_found', 'Issue not found');
    if (issue.status === 'settled') throw new AppError(409, 'already_settled', 'This issue is already settled');

    await this.prisma.$transaction([
      this.prisma.orderIssue.update({ where: { id: issueId }, data: { status: 'settled', settledInId: id, settledById: actorId, settledAt: new Date() } }),
      this.prisma.reconciliationItem.create({
        data: { reconciliationId: id, orderId: issue.orderId, issueId, itemType: 'issue', quantity: issue.quantity, resolution: dto.resolution, note: dto.note },
      }),
    ]);
    await this.audit.log({ actorUserId: actorId, action: 'issue.settle', entityType: 'order_issue', entityId: issueId, after: { resolution: dto.resolution } });
    return { id: issueId, status: 'settled' };
  }

  /**
   * Closing is allowed with issues still open: they stay open and show again tomorrow.
   * Delivered orders still marked as unpaid are reported back so the accountant sees them, but do not block the close.
   */
  async close(actorId: string, id: string, dto: CloseDayDto) {
    const recon = await this.get(id);
    this.assertOpen(recon);
    const r = await this.prisma.dailyReconciliation.update({ where: { id }, data: { status: 'closed', closedById: actorId, closedAt: new Date(), note: dto.note } });
    await this.audit.log({ actorUserId: actorId, action: 'reconciliation.close', entityType: 'daily_reconciliation', entityId: id });
    const view = await this.view(ymd(r.reconDate));
    return { id, status: 'closed', still_open_issues: view.open_issues.length, delivered_but_unpaid: view.delivered_but_unpaid.length };
  }
}
