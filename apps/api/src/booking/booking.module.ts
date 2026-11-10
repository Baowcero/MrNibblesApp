import { Global, Module } from '@nestjs/common';
import { BookingController } from './booking.controller.js';
import { BookingService } from './booking.service.js';

@Global()
@Module({ controllers: [BookingController], providers: [BookingService], exports: [BookingService] })
export class BookingModule {}
