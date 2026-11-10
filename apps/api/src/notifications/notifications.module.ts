import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { PushSender } from './push.js';

@Global()
@Module({ controllers: [NotificationsController], providers: [NotificationsService, PushSender], exports: [NotificationsService] })
export class NotificationsModule {}
