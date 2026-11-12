import { Body, Controller, Get, HttpCode, ParseUUIDPipe, Post, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { ListCustomersDto, RejectCustomerDto } from './customers.dto.js';
import { StaffCustomersService } from './customers.service.js';

@Roles('sales', 'ceo')
@Controller('staff/customers')
export class StaffCustomersController {
  constructor(private readonly customers: StaffCustomersService) {}

  @Get('summary')
  summary() {
    return this.customers.summary();
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.detail(id);
  }

  @Get()
  list(@Query() query: ListCustomersDto) {
    return this.customers.list(query);
  }

  @HttpCode(200)
  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.customers.approve(id, user.id, req.ip);
  }

  @HttpCode(200)
  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCustomerDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.customers.reject(id, user.id, dto.note, req.ip);
  }

  @HttpCode(200)
  @Post(':id/suspend')
  suspend(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.customers.suspend(id, user.id, req.ip);
  }
}
