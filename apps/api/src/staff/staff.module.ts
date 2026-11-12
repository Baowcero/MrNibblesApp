import { Module } from '@nestjs/common';
import { StaffCustomersController } from './customers.controller.js';
import { CustomerImportController, CustomerImportService } from './customer-import.js';
import { StaffCustomersService } from './customers.service.js';
import { StaffOrdersController } from './orders.controller.js';
import { StaffOrdersService } from './orders.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { StaffUsersController } from './users.controller.js';
import { StaffUsersService } from './users.service.js';

@Module({
  controllers: [CustomerImportController, StaffCustomersController, StaffOrdersController, StaffUsersController, ReportsController],
  providers: [CustomerImportService, StaffCustomersService, StaffOrdersService, StaffUsersService, ReportsService],
})
export class StaffModule {}
