import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  type RawBodyRequest,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth.js';
import { PaymentsService } from './payments.service.js';

export class PayDto {
  /** Where Paystack's page should send the customer back to: the app's own link. */
  @IsOptional() @IsString() @MaxLength(300) return_url?: string;
}

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
  pay(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PayDto) {
    return this.payments.initialize(user.id, id, dto?.return_url);
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

/** Paystack sends the customer's browser here when they finish. This page hands them straight back to the app. */
@Controller('payments')
export class PaymentReturnController {
  @Public()
  @Get('return')
  back(@Query('to') to: string | undefined, @Query('reference') reference: string | undefined, @Res() res: Response) {
    const safe = typeof to === 'string' && /^(mrnibbles|exp|exps):\/\//.test(to) ? to : 'mrnibbles://payment-return';
    const target = `${safe}${safe.includes('?') ? '&' : '?'}reference=${encodeURIComponent(reference ?? '')}`;
    const esc = target.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    res.status(200).type('html').send(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<meta http-equiv="refresh" content="0;url=${esc}"><title>Returning to Mr Nibbles</title>` +
        `<body style="font-family:system-ui;background:#fbf5ea;color:#14213d;text-align:center;padding:48px 24px">` +
        `<h2>Payment received</h2><p>Taking you back to the app…</p>` +
        `<p><a href="${esc}" style="display:inline-block;background:#f0831d;color:#fff;padding:14px 24px;border-radius:14px;text-decoration:none;font-weight:700">Open Mr Nibbles</a></p>` +
        `<script>location.href=${JSON.stringify(target)}</script></body>`,
    );
  }
}
