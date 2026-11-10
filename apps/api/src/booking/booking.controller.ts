import { Controller, Get } from '@nestjs/common';
import { BookingService } from './booking.service.js';

@Controller('booking')
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  @Get('status')
  status() {
    return this.booking.status();
  }
}
