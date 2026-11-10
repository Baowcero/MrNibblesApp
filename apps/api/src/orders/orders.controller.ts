import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { CreateOrderDto, ListOrdersDto, QuoteDto } from './dto.js';
import { OrdersService } from './orders.service.js';

@Roles('customer')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @HttpCode(200)
  @Post('quote')
  quote(@Body() dto: QuoteDto) {
    return this.orders.quote(dto);
  }

  /** Send a new Idempotency-Key (any random string) for each order; resending it never double-orders. */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    if (!key || key.length < 8 || key.length > 100) {
      throw new AppError(400, 'idempotency_key_required', 'Send an Idempotency-Key header (8 to 100 characters)');
    }
    return this.orders.create(user.id, dto, key);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListOrdersDto) {
    return this.orders.list(user.id, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(user.id, id);
  }
}
