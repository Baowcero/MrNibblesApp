import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { AssignOrdersDto, DateQueryDto, ReassignDto, StaffOrdersQueryDto } from './orders.dto.js';
import { StaffOrdersService } from './orders.service.js';

@Controller('staff/orders')
export class StaffOrdersController {
  constructor(private readonly orders: StaffOrdersService) {}

  @Roles('sales', 'accounts', 'ceo')
  @Get()
  list(@Query() q: StaffOrdersQueryDto) {
    return this.orders.list(q);
  }

  @Roles('sales', 'accounts', 'ceo', 'production', 'store_keeper')
  @Get('summary')
  summary(@Query() q: DateQueryDto) {
    return this.orders.summary(q.date);
  }

  @Roles('sales', 'accounts', 'ceo')
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(id);
  }

  @Roles('sales', 'ceo')
  @HttpCode(200)
  @Post('assign')
  assign(@CurrentUser() user: AuthUser, @Body() dto: AssignOrdersDto) {
    return this.orders.assign(user.id, dto.order_ids, dto.distributor_id);
  }

  @Roles('sales', 'ceo')
  @HttpCode(200)
  @Post(':id/reassign')
  reassign(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReassignDto) {
    return this.orders.reassign(user.id, id, dto.distributor_id);
  }

  @Roles('sales', 'ceo')
  @HttpCode(200)
  @Post(':id/ready')
  ready(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.markReady(user.id, id);
  }

  @Roles('sales', 'ceo')
  @HttpCode(200)
  @Post(':id/collected')
  collected(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.markCollected(user.id, id);
  }
}
