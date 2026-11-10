import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth.js';
import { PaymentsService } from './payments.service.js';

export class RecordCashDto {
  @IsString() @MinLength(5) @MaxLength(30) order_no!: string;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

/** Customer: pay an order with Paystack. */
@Roles('customer')
@Controller('orders')
export class CustomerPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @HttpCode(200)
  @Post(':id/pay')
  pay(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.initialize(user.id, id);
  }

  @HttpCode(200)
  @Post(':id/pay/verify')
  verify(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.verifyForCustomer(user.id, id);
  }
}

/** Accounts: record cash taken at the office. */
@Roles('accounts', 'ceo')
@Controller('staff/payments')
export class StaffPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @HttpCode(200)
  @Post('cash')
  cash(@CurrentUser() user: AuthUser, @Body() dto: RecordCashDto) {
    return this.payments.recordCash(user.id, dto.order_no.trim().toUpperCase(), dto.note);
  }
}

/** Paystack calls this. It is not logged in; the signature proves it came from Paystack. */
@Controller('webhooks')
export class PaystackWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @HttpCode(200)
  @Post('paystack')
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-paystack-signature') signature: string | undefined) {
    return this.payments.handleWebhook(req.rawBody, signature);
  }
}
