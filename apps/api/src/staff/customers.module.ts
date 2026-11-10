import { Module } from '@nestjs/common';
import { StaffCustomersController } from './customers.controller.js';
import { StaffCustomersService } from './customers.service.js';

@Module({ controllers: [StaffCustomersController], providers: [StaffCustomersService] })
export class StaffCustomersModule {}
