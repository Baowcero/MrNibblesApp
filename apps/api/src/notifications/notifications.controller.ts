import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/auth.js';
import { NotificationsService } from './notifications.service.js';

export class RegisterDeviceDto {
  @IsIn(['ios', 'android']) platform!: 'ios' | 'android';
  /** The Firebase Cloud Messaging token from the phone. */
  @IsString() @MinLength(20) @MaxLength(500) push_token!: string;
}

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @HttpCode(200)
  @Post('devices')
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.notifications.registerDevice(user.id, dto.platform, dto.push_token);
  }

  @Delete('devices/:token')
  remove(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.notifications.removeDevice(user.id, token);
  }

  @Get('notifications')
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  @HttpCode(200)
  @Post('notifications/read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @HttpCode(200)
  @Post('notifications/:id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.id, id);
  }
}
