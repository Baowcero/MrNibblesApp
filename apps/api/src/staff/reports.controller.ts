import { Controller, Get, Query } from '@nestjs/common';
import { IsOptional, Matches } from 'class-validator';
import { Roles } from '../common/auth.js';
import { ReportsService } from './reports.service.js';

class ReportQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}

@Roles('ceo', 'accounts')
@Controller('staff/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('sales')
  sales(@Query() q: ReportQueryDto) {
    return this.reports.sales(q.from, q.to);
  }
}
