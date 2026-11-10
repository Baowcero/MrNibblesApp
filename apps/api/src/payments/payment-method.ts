import { Body, Controller, HttpCode, Injectable, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AppError } from '../common/app-error.js';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { paystackFeeKobo } from '../common/money.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentsService } from './payments.service.js';

export class ChangeMethodDto {
  @IsIn(['paystack', 'office_cash']) payment_method!: 'paystack' | 'office_cash';
}

@Injectable()
export class PaymentMethodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  /**
   * Switches an unpaid order between Paystack and office cash. The Paystack fee is added or removed,
   * so the order total and the payment amount change with it. Only before any money has been received.
   */
  async change(userId: string, orderId: string, method: 'paystack' | 'office_cash') {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customer: { userId } },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw new AppError(404, 'order_not_found', 'Order not found');
    const payment = order.payments[0];
    if (!payment) throw new AppError(409, 'no_payment', 'This order has no payment record');
    if (order.status !== 'placed' || payment.status !== 'pending') {
      throw new AppError(409, 'cannot_change_method', 'The payment method can only be changed before the order is paid');
    }
    if (payment.method === method) return this.present(order.id, payment.method, order.paystackFeeKobo, order.totalKobo);

    // If a Paystack checkout was already opened, make sure it was not completed in the meantime.
    if (payment.method === 'paystack' && payment.paystackReference) {
      let result;
      try {
        result = await this.payments.settleReference(payment.paystackReference);
      } catch (e) {
        if (e instanceof AppError && e.code === 'payment_not_found') result = { settled: false };
        else throw new AppError(503, 'could_not_check_payment', 'We could not check your Paystack payment just now. Please try again in a moment.');
      }
      if (result.settled) throw new AppError(409, 'order_already_paid', 'Your Paystack payment just went through, so this order is paid');
    }

    const fee = method === 'paystack' ? paystackFeeKobo(order.subtotalKobo) : 0n;
    const total = order.subtotalKobo + fee;
    await this.prisma.$transaction([
      this.prisma.payment.update({ where: { id: payment.id }, data: { method, amountKobo: total, feeKobo: fee, paystackReference: null } }),
      this.prisma.order.update({ where: { id: order.id }, data: { paystackFeeKobo: fee, totalKobo: total } }),
      this.prisma.auditLog.create({
        data: { actorUserId: userId, action: 'payment.change_method', entityType: 'order', entityId: order.id, before: { method: payment.method }, after: { method, total_kobo: Number(total) } },
      }),
    ]);
    return this.present(order.id, method, fee, total);
  }

  private present(orderId: string, method: string, fee: bigint, total: bigint) {
    return { order_id: orderId, payment_method: method, paystack_fee_kobo: Number(fee), total_kobo: Number(total) };
  }
}

@Roles('customer')
@Controller('orders')
export class PaymentMethodController {
  constructor(private readonly svc: PaymentMethodService) {}

  @HttpCode(200)
  @Post(':id/payment-method')
  change(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeMethodDto) {
    return this.svc.change(user.id, id, dto.payment_method);
  }
}
