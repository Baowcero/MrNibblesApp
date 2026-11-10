import { Module } from '@nestjs/common';
import { StaffCustomersController } from './customers.controller.js';
import { StaffCustomersService } from './customers.service.js';
import { StaffOrdersController } from './orders.controller.js';
import { StaffOrdersService } from './orders.service.js';
import { StaffUsersController } from './users.controller.js';
import { StaffUsersService } from './users.service.js';

@Module({
  controllers: [StaffCustomersController, StaffOrdersController, StaffUsersController],
  providers: [StaffCustomersService, StaffOrdersService, StaffUsersService],
})
export class StaffModule {}
