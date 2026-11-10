import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { DateQueryDto } from '../staff/orders.dto.js';
import { StorageService } from '../storage/storage.service.js';
import { ConfirmDeliveryDto, FailDeliveryDto } from './dto.js';
import { DistributorService } from './distributor.service.js';

@Roles('distributor')
@Controller('distributor')
export class DistributorController {
  constructor(
    private readonly distributor: DistributorService,
    private readonly storage: StorageService,
  ) {}

  @Get('deliveries')
  list(@CurrentUser() user: AuthUser, @Query() q: DateQueryDto) {
    return this.distributor.list(user.id, q.date);
  }

  @Get('deliveries/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.distributor.detail(user.id, id);
  }

  @HttpCode(200)
  @Post('deliveries/:id/start')
  start(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.distributor.start(user.id, id);
  }

  /** Body is the photo itself (Content-Type image/jpeg, image/png or image/webp, up to 8 MB). */
  @Post('uploads/photo')
  async upload(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Headers('content-type') contentType: string | undefined,
  ) {
    const me = await this.distributor.me(user.id);
    return this.storage.putDeliveryPhoto(me.id, req.body, contentType);
  }

  @HttpCode(200)
  @Post('deliveries/:id/confirm')
  confirm(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmDeliveryDto) {
    return this.distributor.confirm(user.id, id, dto);
  }

  @HttpCode(200)
  @Post('deliveries/:id/fail')
  fail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FailDeliveryDto) {
    return this.distributor.fail(user.id, id, dto);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() q: DateQueryDto) {
    return this.distributor.summary(user.id, q.date);
  }
}
