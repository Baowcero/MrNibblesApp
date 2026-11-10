import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SavingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The balance is the last ledger row's running balance. The ledger is append-only. */
  async mine(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new AppError(404, 'customer_not_found', 'Customer not found');
    const rows = await this.prisma.savingsLedger.findMany({
      where: { customerId: customer.id }, include: { order: true }, orderBy: { createdAt: 'desc' }, take: 50,
    });
    return {
      balance_kobo: rows[0] ? Number(rows[0].balanceAfterKobo) : 0,
      entries: rows.map((r) => ({
        id: r.id, type: r.entryType, amount_kobo: Number(r.amountKobo), balance_after_kobo: Number(r.balanceAfterKobo),
        order_no: r.order?.orderNo ?? null, created_at: r.createdAt.toISOString(),
      })),
    };
  }
}

@Roles('customer')
@Controller('savings')
export class SavingsController {
  constructor(private readonly savings: SavingsService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.savings.mine(user.id);
  }
}

@Module({ controllers: [SavingsController], providers: [SavingsService] })
export class SavingsModule {}
